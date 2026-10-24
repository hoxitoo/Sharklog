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
const { resumePendingPayment, takePaidNotice, checkLicenseStanding, applyRestoreCode } = require('../services/purchase') as typeof import('../services/purchase');

function licence(id: string): string {
  const seg = Buffer.from(JSON.stringify({ v: 1, id, plan: 'lifetime', iat: 1 }), 'ascii').toString('base64url');
  return `SL1.${seg}.${sign(null, Buffer.from(seg, 'ascii'), privateKey).toString('base64url')}`;
}

let invoices = 0;
let licenseAnswer: object = { status: 'pending' };
/** /check — null makes the server unreachable. */
let checkAnswer: object | null = { status: 'ok' };
/** Per-invoice /check answers, over checkAnswer. */
let checkById: Record<string, object> = {};
const fetchMock = jest.fn(async (url: string) => {
  const path = new URL(url).pathname;
  if (path === '/check' && checkById[new URL(url).searchParams.get('inv') ?? '']) {
    const body = checkById[new URL(url).searchParams.get('inv')!];
    return { ok: true, json: async () => body } as Response;
  }
  if (path === '/check' && checkAnswer === null) throw new Error('offline');
  const body = path === '/create'
    ? { inv: String(++invoices), nonce: `n${invoices}`, url: `https://auth.robokassa.ru/Merchant/Index.aspx?InvId=${invoices}` }
    : path === '/check' ? checkAnswer : licenseAnswer;
  return { ok: true, json: async () => body } as Response;
});
(globalThis as { fetch: unknown }).fetch = fetchMock;

beforeEach(async () => {
  await server.clearPendingPayment();
  takePaidNotice();
  invoices = 0;
  licenseAnswer = { status: 'pending' };
  checkAnswer = { status: 'ok' };
  checkById = {};
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

describe('checkLicenseStanding', () => {
  const settings = () => useBetsStore.getState().settings;

  it('drops a licence the server revoked after a refund', async () => {
    useBetsStore.getState().applyLicense(licence('31'));
    checkAnswer = { status: 'revoked' };
    expect(await checkLicenseStanding()).toBe('revoked');
    expect(settings().isPro).toBe(false);
    expect(settings().license).toBeUndefined();
    expect(String(fetchMock.mock.calls.at(-1)![0])).toBe('https://licence.example/check?inv=31');
  });

  it('never reads "could not ask" as revoked — a paying user offline keeps Pro', async () => {
    useBetsStore.getState().applyLicense(licence('32'));
    checkAnswer = null;
    expect(await checkLicenseStanding()).toBe('unreachable');
    checkAnswer = { status: 'something' };
    expect(await checkLicenseStanding()).toBe('unreachable');
    expect(settings().isPro).toBe(true);
  });

  it('keeps a licence in good standing, and asks nothing without one', async () => {
    useBetsStore.getState().applyLicense(licence('33'));
    expect(await checkLicenseStanding()).toBe('ok');
    expect(settings().isPro).toBe(true);
    useBetsStore.setState({ settings: { ...defaultSettings, onboardingComplete: true } });
    fetchMock.mockClear();
    expect(await checkLicenseStanding()).toBe('none');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not drop a licence that replaced the revoked one while the server was asked', async () => {
    useBetsStore.getState().applyLicense(licence('34'));
    checkAnswer = { status: 'revoked' };
    const pending = checkLicenseStanding();
    useBetsStore.getState().applyLicense(licence('35'));
    expect(await pending).toBe('revoked');
    expect(settings().isPro).toBe(true);
    expect(settings().license).toBe(licence('35'));
  });
});

describe('applyRestoreCode — a revoke can be undone', () => {
  const settings = () => useBetsStore.getState().settings;

  it('takes a valid code, and refuses one that is not a licence', async () => {
    expect(await applyRestoreCode(licence('41'))).toBe('ok');
    expect(await applyRestoreCode('hello')).toBe('invalid');
  });

  it('asks the server again about a code this phone saw revoked, and takes it back once undone', async () => {
    useBetsStore.getState().applyLicense(licence('42'));
    useBetsStore.getState().revokeLicense('42');
    // Still revoked on the server: said so, not "invalid".
    checkAnswer = { status: 'revoked' };
    expect(await applyRestoreCode(licence('42'))).toBe('revoked');
    // Offline: cannot tell — said so, nothing changed.
    checkAnswer = null;
    expect(await applyRestoreCode(licence('42'))).toBe('unreachable');
    expect(settings().isPro).toBe(false);
    // The owner sent /unrevoke: the same code works again.
    checkAnswer = { status: 'ok' };
    expect(await applyRestoreCode(licence('42'))).toBe('ok');
    expect(settings().isPro).toBe(true);
    expect(settings().revokedLicenses).toEqual([]);
  });

  it('checks a licence that replaced another while the old one\'s check is in flight', async () => {
    useBetsStore.getState().applyLicense(licence('43'));
    const old = checkLicenseStanding(); // for 43, still in flight
    useBetsStore.getState().applyLicense(licence('44'));
    checkById = { '44': { status: 'revoked' } };
    // Its own request, not the one already running for 43.
    const fresh = checkLicenseStanding();
    expect(fresh).not.toBe(old);
    expect(await fresh).toBe('revoked');
    expect(await old).toBe('ok');
    expect(settings().license).toBeUndefined();
    expect(settings().revokedLicenses).toContain('44');
  });

  it('asks before applying: a refunded code does not wipe a running trial or say "restored"', async () => {
    useBetsStore.getState().startTrial();
    const trial = settings().proExpiresAt;
    checkById = { '45': { status: 'revoked' } };
    expect(await applyRestoreCode(licence('45'))).toBe('revoked');
    expect(settings().proExpiresAt).toBe(trial);
    expect(settings().isPro).toBe(true); // still the trial
    expect(settings().license).toBeUndefined();
    expect(settings().revokedLicenses).toContain('45');
  });

  it('takes a code it could not ask about, if this phone never saw it revoked — a payer offline keeps Pro', async () => {
    checkAnswer = null;
    expect(await applyRestoreCode(licence('46'))).toBe('ok');
    expect(settings().isPro).toBe(true);
  });
});
