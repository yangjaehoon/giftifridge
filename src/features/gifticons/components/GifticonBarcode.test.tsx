import React from 'react';
import { act, render } from '@testing-library/react-native';
import GifticonBarcode from './GifticonBarcode';

const barcodeProps: { current: Record<string, unknown> | null } = { current: null };

jest.mock('@kichiyaki/react-native-barcode-generator', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    barcodeProps.current = props;
    return null;
  },
}));

beforeEach(() => {
  barcodeProps.current = null;
});

describe('GifticonBarcode', () => {
  it('passes the value to the encoder as CODE128', async () => {
    await render(<GifticonBarcode value="8801234567890" />);

    expect(barcodeProps.current).toEqual(
      expect.objectContaining({ value: '8801234567890', format: 'CODE128' }),
    );
  });

  it('renders nothing for an empty value', async () => {
    const { toJSON } = await render(<GifticonBarcode value="   " />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing after the encoder reports an error', async () => {
    const { toJSON } = await render(<GifticonBarcode value="whatever" />);
    expect(barcodeProps.current).not.toBeNull();

    await act(async () => {
      (barcodeProps.current!.onError as (e: unknown) => void)(new Error('bad'));
    });

    expect(toJSON()).toBeNull();
  });
});
