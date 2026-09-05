import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import GalleryAutoImportSettings from './GalleryAutoImportSettings';
import { useGalleryAutoImport } from '../../gifticons/hooks/useGalleryAutoImport';

jest.mock('../../gifticons/hooks/useGalleryAutoImport', () => ({
  useGalleryAutoImport: jest.fn(),
}));

const mockedUseGalleryAutoImport = useGalleryAutoImport as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GalleryAutoImportSettings', () => {
  it('reflects the disabled state and calls toggle on press', async () => {
    const toggle = jest.fn();
    mockedUseGalleryAutoImport.mockReturnValue({ enabled: false, loading: false, toggle });
    const { getByLabelText } = await render(<GalleryAutoImportSettings ownerId="u1" />);

    const toggleSwitch = getByLabelText('사진첩 자동 등록');
    expect(toggleSwitch.props.value).toBe(false);

    fireEvent(toggleSwitch, 'valueChange', true);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('reflects the enabled state', async () => {
    mockedUseGalleryAutoImport.mockReturnValue({
      enabled: true,
      loading: false,
      toggle: jest.fn(),
    });
    const { getByLabelText } = await render(<GalleryAutoImportSettings ownerId="u1" />);

    expect(getByLabelText('사진첩 자동 등록').props.value).toBe(true);
  });

  it('disables the switch while loading', async () => {
    mockedUseGalleryAutoImport.mockReturnValue({
      enabled: false,
      loading: true,
      toggle: jest.fn(),
    });
    const { getByLabelText } = await render(<GalleryAutoImportSettings ownerId="u1" />);

    expect(getByLabelText('사진첩 자동 등록').props.disabled).toBe(true);
  });
});
