import React from 'react';
import { render } from '@testing-library/react-native';
import GifticonCardSkeleton from './GifticonCardSkeleton';
import GifticonDetailSkeleton from './GifticonDetailSkeleton';

describe('gifticon skeletons', () => {
  it('GifticonCardSkeleton renders its placeholder rows', async () => {
    const { toJSON } = await render(<GifticonCardSkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('GifticonDetailSkeleton renders its placeholder layout', async () => {
    const { toJSON } = await render(<GifticonDetailSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});
