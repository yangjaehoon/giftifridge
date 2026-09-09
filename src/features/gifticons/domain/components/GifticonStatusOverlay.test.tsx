import React from 'react';
import { render } from '@testing-library/react-native';
import GifticonStatusOverlay from './GifticonStatusOverlay';

describe('GifticonStatusOverlay', () => {
  it('renders nothing for a null label', async () => {
    const { toJSON } = await render(<GifticonStatusOverlay label={null} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the label, hidden from screen readers', async () => {
    const { getByText, queryByText } = await render(<GifticonStatusOverlay label="사용완료" />);
    expect(queryByText('사용완료')).toBeNull(); // hidden by default from a11y-aware queries
    expect(getByText('사용완료', { includeHiddenElements: true })).toBeTruthy();
  });
});
