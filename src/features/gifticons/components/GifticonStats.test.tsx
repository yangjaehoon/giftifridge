import React from 'react';
import { render } from '@testing-library/react-native';
import GifticonStats from './GifticonStats';
import type { Gifticon } from '../types';

function makeGifticon(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'owner',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://example.com/x.jpg',
    expiresAt: new Date().toISOString(),
    isUsed: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('GifticonStats', () => {
  it('sums amounts, counts items expiring within 7 days, and totals the count', async () => {
    const items: Gifticon[] = [
      makeGifticon({ id: '1', amount: 10000, expiresAt: daysFromNow(3) }),
      makeGifticon({ id: '2', amount: 5000, expiresAt: daysFromNow(20) }),
      makeGifticon({ id: '3', expiresAt: daysFromNow(20) }),
    ];

    const { getByText } = await render(<GifticonStats items={items} />);

    expect(getByText('15,000원')).toBeTruthy();
    expect(getByText('1개')).toBeTruthy();
    expect(getByText('3개')).toBeTruthy();
  });

  it('does not count an already-expired item as expiring soon', async () => {
    const items: Gifticon[] = [makeGifticon({ id: '1', expiresAt: daysFromNow(-1) })];

    const { getByText, getAllByText } = await render(<GifticonStats items={items} />);

    expect(getByText('0원')).toBeTruthy();
    expect(getAllByText('0개')).toHaveLength(1);
    expect(getByText('1개')).toBeTruthy();
  });

  it('excludes an expired gifticon from the total amount', async () => {
    const items: Gifticon[] = [
      makeGifticon({ id: '1', amount: 10000, expiresAt: daysFromNow(5) }),
      makeGifticon({ id: '2', amount: 8000, expiresAt: daysFromNow(-2) }),
    ];

    const { getByText } = await render(<GifticonStats items={items} />);

    expect(getByText('10,000원')).toBeTruthy();
  });

  it('counts the remaining balance, not the face value, for a partially used gift card', async () => {
    const items: Gifticon[] = [
      makeGifticon({
        id: '1',
        amount: 10000,
        expiresAt: daysFromNow(20),
        usageHistory: [{ id: 'u1', amount: 4000, usedAt: '2026-01-01T00:00:00.000Z' }],
      }),
    ];

    const { getByText } = await render(<GifticonStats items={items} />);

    expect(getByText('6,000원')).toBeTruthy();
  });

  it('shows zero values for an empty list', async () => {
    const { getByText, getAllByText } = await render(<GifticonStats items={[]} />);

    expect(getByText('0원')).toBeTruthy();
    expect(getAllByText('0개')).toHaveLength(2);
  });
});
