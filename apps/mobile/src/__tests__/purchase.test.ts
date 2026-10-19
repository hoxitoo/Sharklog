import { generateKeyPairSync, sign } from 'crypto';

// Analytics pulls in react-native; the events are not under test here.
jest.mock('../services/analytics', () => ({ Analytics: { proUpgradeCompleted: jest.fn() } }));

/*
 * The purchase round trip against a fake licence server: the cases the review
 * found could lose a PAID purchase — a second invoice over a waiting one, an
 * invoice the server no longer knows, two alerts for one payment.
 */

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
process.env['EXPO_PUBLIC_LICENSE_PUBKEY'] = Buffer.from(
  (publicKey.export({ format: 'jwk' }) as { x: string }).x, 'base64url',
).toString('base64');
process.env['EXPO_PUBLIC_LICENSE_URL'] = 'https://licence.example';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useBetsStore, defaultSettings } = require('../store/betsStore') as typeof import('../store/betsStore');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const server = require('../services/licenseServer') as typeof import('../services/licenseServer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resumePendingPayment, takePaidNotice } = require('../services/purchase') as typeof import('../services/purchase');

function licence(id: string): string {
  const seg = Buffer.from(JSON.stringify({ v: 1, id, plan: 'lifetime', iat: 1 }), 'ascii').toString('base64url');
  return `SL1.${seg}.${sign(null, Buffer.from(seg, 'ascii'), privateKey).toString('base64url')}`;
}

let invoices = 0;
let licenseAnswer: object = { status: 'pending' };
const fetchMock = jest.fn(async (url: string) => {
  const path = new URL(url).pathname;
  const body = path === '/create'
    ? { inv: String(++invoices), nonce: `n${invoices}`, url: `https://auth.robokassa.ru/Merchant/Index.aspx?InvId=${invoices}` }
    : licenseAnswer;
  return { ok: true, json: async () => body } as Response;
});
(globalThis as { fetch: unknown }).fetch = fetchMock;

beforeEach(async () => {
  await server.clearPendingPayment();
  takePaidNotice();
  invoices = 0;
  licenseAnswer = { status: 'pending' };
  fetchMock.mockClear();
  useBetsStore.setState({ settings: { ...defaultSettings, onboardingComplete: true }, isLoaded: true });
});

describe('createPayment', () => {
  it('reuses the invoice that is waiting instead of overwriting it', async () => {
    const first = await server.createPayment();
    const second = await server.createPayment();
    expect(second).toEqual(first);
    expect(invoices).toBe(1);
  });

  it('opens one invoice for a double tap', async () => {
    const [a, b] = await Promise.all([server.createPayment(), server.createPayment()]);
    expect(a).toEqual(b);
    expect(invoices).toBe(1);
  });

  it('refuses a payment page that is not Robokassa', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ inv: '9', nonce: 'x', url: 'https://evil.example/pay' }) }) as Response);
    expect(await server.createPayment()).toBeNull();
    expect(await server.getPendingPayment()).toBeNull();
  });
});

describe('resumePendingPayment', () => {
  it('collects the licence once the payment arrives, and says so once', async () => {
    const p = await server.createPayment();
    expect(await resumePendingPayment()).toBe('pending');
    licenseAnswer = { status: 'paid', license: licence(p!.inv) };
    const [a, b] = await Promise.all([resumePendingPayment(), resumePendingPayment()]);
    expect([a, b]).toEqual(['paid', 'paid']);
    expect(useBetsStore.getState().settings.isPro).toBe(true);
    expect(await server.getPendingPayment()).toBeNull();
    expect(takePaidNotice()).toBe(true);
    expect(takePaidNotice()).toBe(false);
  });

  it('lets go of an invoice the server does not know', async () => {
    await server.createPayment();
    licenseAnswer = { status: 'unknown' };
    expect(await resumePendingPayment()).toBe('none');
    expect(await server.getPendingPayment()).toBeNull();
  });

  it('keeps the invoice when the server cannot be reached', async () => {
    await server.createPayment();
    fetchMock.mockImplementationOnce(async () => { throw new Error('offline'); });
    expect(await resumePendingPayment()).toBe('unreachable');
    expect(await server.getPendingPayment()).not.toBeNull();
  });

  it('keeps the invoice when the licence does not verify (a key mix-up, not a payment problem)', async () => {
    await server.createPayment();
    licenseAnswer = { status: 'paid', license: 'SL1.bad.sig' };
    expect(await resumePendingPayment()).toBe('unreachable');
    expect(await server.getPendingPayment()).not.toBeNull();
    expect(useBetsStore.getState().settings.isPro).toBe(false);
  });
});
