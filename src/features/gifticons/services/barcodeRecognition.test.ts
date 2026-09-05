import BarcodeScanning, { BarcodeFormat } from '@react-native-ml-kit/barcode-scanning';
import { recognizeBarcodeFromImage } from './barcodeRecognition';

jest.mock('@react-native-ml-kit/barcode-scanning', () => ({
  __esModule: true,
  default: { scan: jest.fn() },
  BarcodeFormat: {
    CODE_128: 1,
    CODE_39: 2,
    CODE_93: 4,
    CODABAR: 8,
    DATA_MATRIX: 16,
    EAN_13: 32,
    EAN_8: 64,
    ITF: 128,
    QR_CODE: 256,
    UPC_A: 512,
    UPC_E: 1024,
    PDF417: 2048,
    AZTEC: 4096,
  },
}));

const mockedScan = BarcodeScanning.scan as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recognizeBarcodeFromImage', () => {
  it('returns the first match found in the photo', async () => {
    mockedScan.mockResolvedValue([
      { format: BarcodeFormat.CODE_128, value: '8801234567890' },
      { format: BarcodeFormat.CODE_128, value: '8800000000000' },
    ]);

    await expect(recognizeBarcodeFromImage('file:///gifticon.jpg')).resolves.toBe('8801234567890');
    expect(mockedScan).toHaveBeenCalledWith('file:///gifticon.jpg');
  });

  it('prefers a linear barcode over a QR code found in the same photo', async () => {
    mockedScan.mockResolvedValue([
      { format: BarcodeFormat.QR_CODE, value: 'https://example.com/redeem?x=1' },
      { format: BarcodeFormat.CODE_128, value: '8801234567890' },
    ]);

    await expect(recognizeBarcodeFromImage('file:///gifticon.jpg')).resolves.toBe('8801234567890');
  });

  it('falls back to a QR/2D code when no linear barcode was found', async () => {
    mockedScan.mockResolvedValue([{ format: BarcodeFormat.QR_CODE, value: '8801234567890' }]);

    await expect(recognizeBarcodeFromImage('file:///gifticon.jpg')).resolves.toBe('8801234567890');
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
