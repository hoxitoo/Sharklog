// Parses free-form bookmaker text (Fonbet, BetCity, 1xBet, etc.)
// and extracts bet fields for pre-filling the AddBet form.

export interface ParsedBet {
  event: string;
  pick: string;
  odds: string;
  stake: string;
}

function cleanLine(l: string) {
  return l.trim().replace(/\s+/g, ' ');
}

function parseOddsStr(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

function findOdds(lines: string[]): string {
  // Priority 1: explicit label ("Коэф: 2.10", "× 2.10", "@ 2.10")
  for (const line of lines) {
    const m = line.match(/(?:коэф|odds|×|x|@)\s*[:.:]?\s*(\d{1,3}[.,]\d{1,3})/i);
    const raw = m?.[1];
    if (raw) {
      const v = parseOddsStr(raw);
      if (v > 1 && v <= 100) return raw.replace(',', '.');
    }
  }
  // Priority 2: standalone decimal on its own line (e.g. "2.10")
  for (const line of lines) {
    const m = line.match(/^(\d{1,3}[.,]\d{2,3})$/);
    const raw = m?.[1];
    if (raw) {
      const v = parseOddsStr(raw);
      if (v > 1.01 && v <= 50) return raw.replace(',', '.');
    }
  }
  // Priority 3: any in-range decimal not on a money line
  for (const line of lines) {
    if (/₽|руб/i.test(line)) continue;
    const m = line.match(/\b(\d{1,2}[.,]\d{2})\b/);
    const raw = m?.[1];
    if (raw) {
      const v = parseOddsStr(raw);
      if (v > 1.01 && v < 50) return raw.replace(',', '.');
    }
  }
  return '';
}

function findStake(lines: string[]): string {
  // Priority 1: number followed by ₽ (skip "выигрыш" lines)
  for (const line of lines) {
    if (/выигрыш|возможн|potential|return/i.test(line)) continue;
    const m = line.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*₽/);
    const raw = m?.[1];
    if (raw) {
      const v = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
      if (v > 0) return String(Math.round(v));
    }
  }
  // Priority 2: after "сумма / ставка / amount"
  for (const line of lines) {
    const m = line.match(/(?:сумм[аую]|ставка|amount)[:\s]+(\d[\d\s,.']+)/i);
    const raw = m?.[1];
    if (raw) {
      const v = parseFloat(raw.replace(/\s/g, '').replace(/[,'](\d{3})/g, '$1').replace(',', '.'));
      if (v > 0) return String(Math.round(v));
    }
  }
  return '';
}

function findEvent(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/^(.+?)\s*(?:—|–|vs\.?|против|-)\s*(.+)$/i);
    if (!m) continue;
    const t1 = m[1]?.trim() ?? '';
    const t2 = m[2]?.trim() ?? '';
    if (t1.length >= 3 && t2.length >= 3 && !/^\d+[.,]?\d*$/.test(t1)) {
      return `${t1} — ${t2}`;
    }
  }
  return '';
}

function findPick(lines: string[], event: string): string {
  // Priority 1: explicit label
  for (const line of lines) {
    const m = line.match(/(?:выбор|исход|selection|pick|ставка на|тип)[:\s]+(.+)/i);
    const v = m?.[1]?.trim();
    if (v) return v;
  }
  // Priority 2: known patterns
  for (const line of lines) {
    const m = line.match(/\b(П[12]|Х|1X|X2|ТБ\s*[\d.,]+|ТМ\s*[\d.,]+|TO\s*[\d.,]+|TU\s*[\d.,]+|фора|handicap|over|under|draw|win|W[12])\b/i);
    const v = m?.[1]?.trim();
    if (v) return v;
  }
  // Priority 3: short readable line that's not event/odds/money/headers
  const SKIP = /ставка|принята|выигрыш|возможн|сумма|коэф|спорт|лига|чемпионат|букмекер|номер|дата|время/i;
  const eventFirstPart = event.split('—')[0]?.trim() ?? '';
  for (const line of lines) {
    if (line.length < 2 || line.length > 60) continue;
    if (SKIP.test(line)) continue;
    if (eventFirstPart && line.includes(eventFirstPart)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/₽|руб/i.test(line)) continue;
    if (/^\d+[.,]\d{2}$/.test(line)) continue;
    return line;
  }
  return '';
}

export function parseClipboardText(text: string): ParsedBet {
  const lines = text
    .split(/\n|\r\n|\r/)
    .map(cleanLine)
    .filter((l) => l.length > 0);

  const event = findEvent(lines);
  const odds = findOdds(lines);
  const stake = findStake(lines);
  const pick = findPick(lines, event);

  return { event, pick, odds, stake };
}

export function isUsefulPaste(p: ParsedBet): boolean {
  return !!(p.event || p.odds || p.stake);
}
