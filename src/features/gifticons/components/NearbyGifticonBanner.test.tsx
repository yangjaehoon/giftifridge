import React from 'react';
import { render } from '@testing-library/react-native';
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
});
