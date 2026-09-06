import React from 'react';
import { render } from '@testing-library/react-native';
import ExpiredRefundNotice from './ExpiredRefundNotice';

describe('ExpiredRefundNotice', () => {
  it('explains the 5-year / 90% refund and where to ask', async () => {
    const { getByText } = await render(<ExpiredRefundNotice />);
    expect(getByText(/환급받을 수 있어요/)).toBeTruthy();
    expect(getByText(/5년/)).toBeTruthy();
    expect(getByText(/90%/)).toBeTruthy();
  });
});
