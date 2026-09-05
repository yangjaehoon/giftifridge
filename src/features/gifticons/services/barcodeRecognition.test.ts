import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';
import { recognizeBarcodeFromImage } from './barcodeRecognition';

jest.mock('@react-native-ml-kit/barcode-scanning', () => ({
  __esModule: true,
  default: { scan: jest.fn() },
}));

const mockedScan = BarcodeScanning.scan as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recognizeBarcodeFromImage', () => {
  it('returns the first match found in the photo', async () => {
    mockedScan.mockResolvedValue([
      { format: 1, value: '8801234567890' },
      { format: 1, value: '8800000000000' },
    ]);

    await expect(recognizeBarcodeFromImage('file:///gifticon.jpg')).resolves.toBe('8801234567890');
    expect(mockedScan).toHaveBeenCalledWith('file:///gifticon.jpg');
  });

  it('returns null when no barcode is found', async () => {
    mockedScan.mockResolvedValue([]);
    await expect(recognizeBarcodeFromImage('file:///gifticon.jpg')).resolves.toBeNull();
  });

  it('returns null when scanning throws', async () => {
    mockedScan.mockRejectedValue(new Error('ml kit unavailable'));
    await expect(recognizeBarcodeFromImage('file:///gifticon.jpg')).resolves.toBeNull();
  });
});
