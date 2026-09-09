import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import BarcodeCard from './BarcodeCard';
import { haptics } from '../../../shared/utils/haptics';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../../../shared/utils/haptics', () => ({ haptics: { selection: jest.fn() } }));
jest.mock('./GifticonBarcode', () => ({ __esModule: true, default: () => null }));

const mockedCopy = Clipboard.setStringAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockedCopy.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('BarcodeCard', () => {
  it('renders the barcode number in 4-digit groups', async () => {
    const { getByLabelText } = await render(<BarcodeCard value="8801234567" onZoom={jest.fn()} />);
    expect(getByLabelText('8801234567').props.children).toBe('8801 2345 67');
  });

  it('calls onZoom when the barcode is tapped', async () => {
    const onZoom = jest.fn();
    const { getByLabelText } = await render(<BarcodeCard value="8801234567" onZoom={onZoom} />);

    fireEvent.press(getByLabelText('바코드 크게 보기'));

    expect(onZoom).toHaveBeenCalledTimes(1);
  });

  it('copies the value, fires a haptic, and shows a transient confirmation', async () => {
    const { getByLabelText, getByText } = await render(
      <BarcodeCard value="8801234567" onZoom={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('바코드 번호 복사'));
    });

    expect(mockedCopy).toHaveBeenCalledWith('8801234567');
    expect(haptics.selection).toHaveBeenCalledTimes(1);
    expect(getByText('복사됨 ✓')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(getByText('번호 복사')).toBeTruthy();
  });

  it('does not leak the confirmation from a rapid second copy', async () => {
    const { getByLabelText, getByText } = await render(
      <BarcodeCard value="8801234567" onZoom={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('바코드 번호 복사'));
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
      fireEvent.press(getByLabelText('바코드 번호 복사'));
    });
    // The first timer was cleared, so 1s after the second press it's still shown.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(getByText('복사됨 ✓')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(getByText('번호 복사')).toBeTruthy();
  });
});
