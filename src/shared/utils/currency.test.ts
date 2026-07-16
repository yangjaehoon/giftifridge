import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('formats thousands with a separator and a 원 suffix', () => {
    expect(formatCurrency(10000)).toBe('10,000원');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('0원');
  });

  it('formats small amounts without a separator', () => {
    expect(formatCurrency(500)).toBe('500원');
  });
});
