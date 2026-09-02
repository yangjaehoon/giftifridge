import { daysUntil, formatDate, parseDate, toDateString, todayDateString } from './date';

describe('toDateString / todayDateString', () => {
  it('formats a Date as its local YYYY-MM-DD', () => {
    expect(toDateString(new Date(2026, 2, 9))).toBe('2026-03-09');
  });

  it('todayDateString matches toDateString(now)', () => {
    expect(todayDateString()).toBe(toDateString(new Date()));
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD to local midnight', () => {
    const d = parseDate('2026-08-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('tolerates a legacy full ISO instant, collapsing it to local midnight', () => {
    const d = parseDate('2026-08-01T15:30:00.000Z');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('round-trips with toDateString', () => {
    expect(toDateString(parseDate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    expect(daysUntil(todayDateString())).toBe(0);
  });

  it('returns a positive count for a future calendar day', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(daysUntil(toDateString(future))).toBe(5);
  });

  it('returns a negative count for a past calendar day', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(daysUntil(toDateString(past))).toBe(-3);
  });

  it('still works on a legacy ISO instant', () => {
    expect(daysUntil(new Date().toISOString())).toBe(0);
  });
});

describe('formatDate', () => {
  it('formats a YYYY-MM-DD string as YYYY.MM.DD', () => {
    expect(formatDate('2026-01-05')).toBe('2026.01.05');
  });

  it('formats a full ISO instant by its local calendar day', () => {
    expect(formatDate('2026-03-09T12:00:00.000Z')).toBe('2026.03.09');
  });
});
