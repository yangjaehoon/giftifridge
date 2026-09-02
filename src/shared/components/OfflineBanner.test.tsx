import React from 'react';
import { render } from '@testing-library/react-native';
import OfflineBanner from './OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

jest.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(),
}));

const mockedUseNetworkStatus = useNetworkStatus as jest.Mock;

describe('OfflineBanner', () => {
  it('renders nothing while connected', async () => {
    mockedUseNetworkStatus.mockReturnValue(true);
    const { queryByText } = await render(<OfflineBanner />);
    expect(queryByText('오프라인 상태예요')).toBeNull();
  });

  it('shows the offline message when disconnected', async () => {
    mockedUseNetworkStatus.mockReturnValue(false);
    const { getByText } = await render(<OfflineBanner />);
    expect(getByText('오프라인 상태예요')).toBeTruthy();
  });
});
