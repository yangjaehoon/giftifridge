import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import GifticonCard from './GifticonCard';
import type { Gifticon } from '../types';

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function makeGifticon(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'owner',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://example.com/x.jpg',
    expiresAt: daysFromNow(30),
    isUsed: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('GifticonCard', () => {
  it('shows the brand, category label, name, and amount', async () => {
    const { getByText } = await render(
      <GifticonCard gifticon={makeGifticon({ id: '1', amount: 4500 })} onPress={jest.fn()} />,
    );

    expect(getByText('스타벅스 · 카페')).toBeTruthy();
    expect(getByText('아메리카노')).toBeTruthy();
    expect(getByText('4,500원')).toBeTruthy();
  });

  it('shows the remaining balance, not the face value, once partially used', async () => {
    const { getByText, queryByText } = await render(
      <GifticonCard
        gifticon={makeGifticon({
          id: '1',
          amount: 10000,
          usageHistory: [{ id: 'u1', amount: 3000, usedAt: '2026-01-01T00:00:00.000Z' }],
        })}
        onPress={jest.fn()}
      />,
    );

    expect(getByText('7,000원 남음')).toBeTruthy();
    expect(queryByText('10,000원')).toBeNull();
  });

  it('omits the amount line when there is no amount', async () => {
    const { queryByText } = await render(
      <GifticonCard gifticon={makeGifticon({ id: '1' })} onPress={jest.fn()} />,
    );
    expect(queryByText(/원$/)).toBeNull();
  });

  it('renders a plain D-day for a gifticon expiring far in the future', async () => {
    const { getByText } = await render(
      <GifticonCard
        gifticon={makeGifticon({ id: '1', expiresAt: daysFromNow(10) })}
        onPress={jest.fn()}
      />,
    );
    expect(getByText('D-10')).toBeTruthy();
  });

  it('renders a D-day badge when expiring within 3 days', async () => {
    const { getByText } = await render(
      <GifticonCard
        gifticon={makeGifticon({ id: '1', expiresAt: daysFromNow(2) })}
        onPress={jest.fn()}
      />,
    );
    expect(getByText('D-2')).toBeTruthy();
  });

  it('stamps the expired label across the image for a past expiry date', async () => {
    const { getByText } = await render(
      <GifticonCard
        gifticon={makeGifticon({ id: '1', expiresAt: daysFromNow(-1) })}
        onPress={jest.fn()}
      />,
    );
    // Hidden from screen readers on purpose — the card's own accessibilityLabel
    // already speaks the status — so this query must opt back in to find it.
    expect(getByText('기한만료', { includeHiddenElements: true })).toBeTruthy();
  });

  it('stamps the used label (taking priority over expiry) when marked used', async () => {
    const { getByText, queryByText } = await render(
      <GifticonCard
        gifticon={makeGifticon({ id: '1', isUsed: true, expiresAt: daysFromNow(-5) })}
        onPress={jest.fn()}
      />,
    );
    expect(getByText('사용완료', { includeHiddenElements: true })).toBeTruthy();
    expect(queryByText('기한만료', { includeHiddenElements: true })).toBeNull();
  });

  it('calls onPress when the card is tapped', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <GifticonCard gifticon={makeGifticon({ id: '1' })} onPress={onPress} />,
    );
    fireEvent.press(getByText('아메리카노'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a single spoken label summarising the card', async () => {
    const { getByLabelText } = await render(
      <GifticonCard
        gifticon={makeGifticon({ id: '1', amount: 4500, expiresAt: daysFromNow(10) })}
        onPress={jest.fn()}
      />,
    );
    expect(getByLabelText(/스타벅스 아메리카노, 4,500원, 유효기한 .+, 10일 남음/)).toBeTruthy();
  });
});
