import { formatCurrency, groupDigits } from './currency';

describe('groupDigits', () => {
  it('groups a digit string with thousands separators', () => {
    expect(groupDigits('10000')).toBe('10,000');
  });

  it('returns an empty string unchanged', () => {
    expect(groupDigits('')).toBe('');
  });

  it('leaves short numbers ungrouped', () => {
    expect(groupDigits('500')).toBe('500');
  });
});

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
