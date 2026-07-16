import { daysUntil, formatDate } from './date';

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    expect(daysUntil(new Date().toISOString())).toBe(0);
  });

  it('returns a positive count for a future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(daysUntil(future.toISOString())).toBe(5);
  });

  it('returns a negative count for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(daysUntil(past.toISOString())).toBe(-3);
  });
});

describe('formatDate', () => {
  it('formats an ISO string as YYYY.MM.DD', () => {
    expect(formatDate('2026-01-05T00:00:00.000Z')).toBe('2026.01.05');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatDate('2026-03-09T12:00:00.000Z')).toBe('2026.03.09');
  });
});
