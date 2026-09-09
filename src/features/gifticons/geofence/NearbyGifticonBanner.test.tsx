import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import NearbyGifticonBanner from './NearbyGifticonBanner';
import type { Gifticon } from '../types';

function makeGifticon(id: string, brand: string): Gifticon {
  return {
    id,
    ownerId: 'owner',
    name: '아메리카노',
    brand,
    category: 'cafe',
    imageUrl: 'https://example.com/x.jpg',
    expiresAt: new Date().toISOString(),
    isUsed: false,
    createdAt: new Date().toISOString(),
  };
}

describe('NearbyGifticonBanner', () => {
  it('renders nothing when there are no nearby items', async () => {
    const { toJSON } = await render(<NearbyGifticonBanner items={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('lists the distinct brands of nearby gifticons', async () => {
    const { getByText } = await render(
      <NearbyGifticonBanner
        items={[
          makeGifticon('1', '스타벅스'),
          makeGifticon('2', '스타벅스'),
          makeGifticon('3', '투썸플레이스'),
        ]}
      />,
    );

    expect(getByText('근처에 사용 안 한 기프티콘이 있어요: 스타벅스, 투썸플레이스')).toBeTruthy();
  });

  it('can be dismissed and re-arms when the nearby brands change', async () => {
    const { getByLabelText, queryByText, rerender } = await render(
      <NearbyGifticonBanner items={[makeGifticon('1', '스타벅스')]} />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('알림 닫기'));
    });
    expect(queryByText(/근처에/)).toBeNull();

    // Same brand set → stays dismissed.
    await rerender(<NearbyGifticonBanner items={[makeGifticon('1', '스타벅스')]} />);
    expect(queryByText(/근처에/)).toBeNull();

    // Different brand → banner comes back.
    await rerender(<NearbyGifticonBanner items={[makeGifticon('2', '투썸플레이스')]} />);
    expect(queryByText(/근처에/)).toBeTruthy();
  });
});
