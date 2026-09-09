import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { recognizeText } from '../ocr/ocrService';
import { recognizeBarcodeFromImage } from '../ocr/barcodeRecognition';
import { newGifticonId } from '../domain/services/gifticonService';
import { saveGifticon } from '../domain/services/saveGifticon';
import { syncGifticonReminders } from '../domain/services/gifticonReminders';
import { ensureGalleryImportPermission, scanGalleryForGifticons } from './galleryImport';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-media-library', () => {
  class Query {
    eq() {
      return this;
    }
    gte() {
      return this;
    }
    orderBy() {
      return this;
    }
    limit() {
      return this;
    }
    // A real (prototype) method here, not a field, so it's declared on the
    // class the same way eq/gte/orderBy/limit are — letting the reassignment
    // below type-check — while staying reassignable on the shared prototype
    // (a field initializer would instead be a per-instance property, and
    // `Query.prototype.exe` the tests read before any instance exists would
    // be undefined).
    exe(): Promise<unknown[]> {
      return Promise.resolve([]);
    }
  }
  Query.prototype.exe = jest.fn();
  return {
    Query,
    AssetField: { CREATION_TIME: 'creationTime', MEDIA_TYPE: 'mediaType' },
    MediaType: { IMAGE: 'image' },
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
  };
});
jest.mock('../ocr/ocrService', () => ({
  ...jest.requireActual('../ocr/ocrService'),
  recognizeText: jest.fn(),
}));
jest.mock('../ocr/barcodeRecognition', () => ({ recognizeBarcodeFromImage: jest.fn() }));
jest.mock('../domain/services/gifticonService', () => ({ newGifticonId: jest.fn() }));
jest.mock('../domain/services/saveGifticon', () => ({ saveGifticon: jest.fn() }));
jest.mock('../domain/services/gifticonReminders', () => ({ syncGifticonReminders: jest.fn() }));

const mockedExe = MediaLibrary.Query.prototype.exe as jest.Mock;
const mockedGetPermissions = MediaLibrary.getPermissionsAsync as jest.Mock;
const mockedRequestPermissions = MediaLibrary.requestPermissionsAsync as jest.Mock;
const mockedRecognizeText = recognizeText as jest.Mock;
const mockedRecognizeBarcode = recognizeBarcodeFromImage as jest.Mock;
const mockedNewGifticonId = newGifticonId as jest.Mock;
const mockedSaveGifticon = saveGifticon as jest.Mock;
const mockedSyncReminders = syncGifticonReminders as jest.Mock;

function fakeAsset(id: string, creationTime: number, uri = `file:///${id}.jpg`) {
  return {
    id,
    getCreationTime: jest.fn().mockResolvedValue(creationTime),
    getUri: jest.fn().mockResolvedValue(uri),
  };
}

function ocrResult(text: string) {
  return { text, lines: text.split('\n').map((line) => ({ text: line, height: 0 })) };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockedGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mockedExe.mockResolvedValue([]);
  mockedRecognizeBarcode.mockResolvedValue(null);
  mockedNewGifticonId.mockReturnValue('draft-1');
  mockedSaveGifticon.mockResolvedValue('draft-1');
  mockedSyncReminders.mockResolvedValue(undefined);
});

describe('ensureGalleryImportPermission', () => {
  it('returns true when already granted', async () => {
    mockedGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
    await expect(ensureGalleryImportPermission()).resolves.toBe(true);
    expect(mockedRequestPermissions).not.toHaveBeenCalled();
  });

  it('requests permission when not yet granted but askable', async () => {
    mockedGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockedRequestPermissions.mockResolvedValue({ granted: true });
    await expect(ensureGalleryImportPermission()).resolves.toBe(true);
  });

  it('returns false when denied and cannot ask again', async () => {
    mockedGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(ensureGalleryImportPermission()).resolves.toBe(false);
    expect(mockedRequestPermissions).not.toHaveBeenCalled();
  });
});

describe('scanGalleryForGifticons', () => {
  it('is a no-op without permission', async () => {
    mockedGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    await expect(scanGalleryForGifticons('u1')).resolves.toBe(0);
    expect(mockedExe).not.toHaveBeenCalled();
  });

  it('creates a gifticon from a photo with a parseable expiry date, guessing brand/name', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(
      ocrResult('스타벅스\n아메리카노 Tall\n유효기간 2028.12.31까지'),
    );

    await expect(scanGalleryForGifticons('u1')).resolves.toBe(1);

    expect(mockedSaveGifticon).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-1',
        ownerId: 'u1',
        imageUri: 'file:///a1.jpg',
        imageChanged: true,
        fields: expect.objectContaining({
          name: '아메리카노 Tall',
          brand: '스타벅스',
          category: 'cafe',
          expiresAt: '2028-12-31',
        }),
      }),
    );
    expect(mockedSyncReminders).toHaveBeenCalledWith(
      expect.objectContaining({ isOwner: true, isEditing: false }),
    );
  });

  it('falls back to placeholder brand/name/category when nothing usable is guessed', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('기프티콘\n유효기간 2028.12.31까지'));

    await scanGalleryForGifticons('u1');

    expect(mockedSaveGifticon).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          name: '새 기프티콘',
          brand: '미확인 브랜드',
          category: 'etc',
        }),
      }),
    );
  });

  it('includes a keyword-anchored amount found in the text', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(
      ocrResult('스타벅스\n아메리카노 Tall\n금액 10,000원\n유효기간 2028.12.31까지'),
    );

    await scanGalleryForGifticons('u1');

    expect(mockedSaveGifticon).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ amount: 10000 }),
      }),
    );
  });

  it('skips a photo whose barcode is already in the cached gifticon list', async () => {
    await AsyncStorage.setItem(
      'gifticonCache:owner:u1',
      JSON.stringify([
        {
          id: 'existing',
          ownerId: 'u1',
          name: '아메리카노',
          brand: '스타벅스',
          category: 'cafe',
          imageUrl: 'https://example/x.jpg',
          expiresAt: '2028-12-31',
          isUsed: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          barcode: '8801234567890',
        },
      ]),
    );
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(
      ocrResult('스타벅스\n아메리카노 Tall\n바코드 8801234567890\n유효기간 2028.12.31까지'),
    );

    await expect(scanGalleryForGifticons('u1')).resolves.toBe(0);
    expect(mockedSaveGifticon).not.toHaveBeenCalled();
  });

  it('drops a bare "N원" on a cafe/restaurant coupon (a menu price, not a face value)', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(
      ocrResult('스타벅스\n아메리카노 T 4,500원\n교환처 전국\n유효기간 2028.12.31까지'),
    );

    await scanGalleryForGifticons('u1');

    const fields = mockedSaveGifticon.mock.calls[0][0].fields;
    expect(fields.amount).toBeUndefined();
  });

  it('includes a barcode found in the photo itself', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(
      ocrResult('스타벅스\n아메리카노 Tall\n유효기간 2028.12.31까지'),
    );
    mockedRecognizeBarcode.mockResolvedValue('8801234567890');

    await scanGalleryForGifticons('u1');

    expect(mockedSaveGifticon).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ barcode: '8801234567890' }),
      }),
    );
  });

  it('falls back to a barcode number printed in the OCR text when the photo itself has none', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(
      ocrResult('스타벅스\n아메리카노 Tall\n바코드 8801234567890\n유효기간 2028.12.31까지'),
    );
    mockedRecognizeBarcode.mockResolvedValue(null);

    await scanGalleryForGifticons('u1');

    expect(mockedSaveGifticon).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ barcode: '8801234567890' }),
      }),
    );
  });

  it('does not barcode-scan a photo that never even looked like a gifticon', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('오늘 점심 메뉴 사진'));

    await scanGalleryForGifticons('u1');

    expect(mockedRecognizeBarcode).not.toHaveBeenCalled();
  });

  it('skips a keyword match with no readable expiry date (never invents one)', async () => {
    // No confirmation step downstream, so an auto-create must not guess the
    // expiry — a photo we cannot date is left for the user to add by hand.
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('기프티콘 도착!'));

    await expect(scanGalleryForGifticons('u1')).resolves.toBe(0);
    expect(mockedSaveGifticon).not.toHaveBeenCalled();
    expect(mockedRecognizeBarcode).not.toHaveBeenCalled();
  });

  it('skips a dated photo that carries no other gifticon signal', async () => {
    // A receipt or reservation has a date but no barcode, known brand, or
    // gifticon keyword — one signal is not enough for a no-review create.
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('예약 확인\n방문일 2028.12.31\n2명'));

    await expect(scanGalleryForGifticons('u1')).resolves.toBe(0);
    expect(mockedSaveGifticon).not.toHaveBeenCalled();
  });

  it('skips a photo whose expiry could only be guessed (several dates, no keyword)', async () => {
    // parseExpiryDateResult falls back to the latest date here; a no-review
    // create must not run on a guessed expiry, even with a gifticon keyword.
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(
      ocrResult('기프티콘\n발행 2025.01.01\n행사 종료 2027.12.31'),
    );

    await expect(scanGalleryForGifticons('u1')).resolves.toBe(0);
    expect(mockedSaveGifticon).not.toHaveBeenCalled();
  });

  it('skips a photo whose OCR text has no gifticon signal', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('오늘 점심 메뉴 사진'));

    await expect(scanGalleryForGifticons('u1')).resolves.toBe(0);
    expect(mockedSaveGifticon).not.toHaveBeenCalled();
  });

  it('skips a photo whose OCR failed (null text)', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(null);

    await expect(scanGalleryForGifticons('u1')).resolves.toBe(0);
    expect(mockedSaveGifticon).not.toHaveBeenCalled();
  });

  it('never re-OCRs an asset id it has already processed', async () => {
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('오늘 점심 메뉴 사진'));

    await scanGalleryForGifticons('u1');
    await scanGalleryForGifticons('u1');

    expect(mockedRecognizeText).toHaveBeenCalledTimes(1);
  });

  it('holds a close-but-not-enough dated photo for a retry instead of a permanent skip', async () => {
    await AsyncStorage.setItem('galleryImportLastCheckedAt', '500');
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    // "유효기간 <date>까지" alone scores 5 (< threshold 6) but has a real date.
    mockedRecognizeText.mockResolvedValue(ocrResult('유효기간 2028.12.31 까지'));

    await scanGalleryForGifticons('u1');

    expect(mockedSaveGifticon).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem('galleryImportImportedIds')) ?? '[]')).toEqual(
      [],
    );
    // cursor held at the asset so a later scan re-fetches it
    expect(await AsyncStorage.getItem('galleryImportLastCheckedAt')).toBe('1000');
    expect(JSON.parse((await AsyncStorage.getItem('galleryImportRetries')) ?? '{}')).toEqual({
      a1: 1,
    });
  });

  it('gives up on a retried photo after the cap and marks it done', async () => {
    await AsyncStorage.setItem('galleryImportRetries', JSON.stringify({ a1: 2 }));
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('유효기간 2028.12.31 까지'));

    await scanGalleryForGifticons('u1');

    expect(JSON.parse((await AsyncStorage.getItem('galleryImportImportedIds')) ?? '[]')).toEqual([
      'a1',
    ]);
    expect(JSON.parse((await AsyncStorage.getItem('galleryImportRetries')) ?? '{}')).toEqual({});
  });

  it('advances the scan cursor past the newest processed asset', async () => {
    await AsyncStorage.setItem('galleryImportLastCheckedAt', '1000');
    mockedExe.mockResolvedValueOnce([fakeAsset('a1', 5_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('오늘 점심 메뉴 사진'));

    await scanGalleryForGifticons('u1');

    expect(await AsyncStorage.getItem('galleryImportLastCheckedAt')).toBe('5000');
  });

  it('on the very first run, sets the cursor to now instead of backfilling the whole library', async () => {
    const before = Date.now();
    mockedExe.mockResolvedValue([]);

    await scanGalleryForGifticons('u1');

    const stored = Number(await AsyncStorage.getItem('galleryImportLastCheckedAt'));
    expect(stored).toBeGreaterThanOrEqual(before);
  });

  it('shares one in-flight scan instead of running two overlapping ones', async () => {
    let resolveExe: (assets: unknown[]) => void = () => {};
    mockedExe.mockReturnValue(new Promise((resolve) => (resolveExe = resolve)));

    const first = scanGalleryForGifticons('u1');
    const second = scanGalleryForGifticons('u1');
    resolveExe([]);

    await Promise.all([first, second]);
    expect(mockedExe).toHaveBeenCalledTimes(1);
  });

  it('runs a fresh scan after the previous one has finished', async () => {
    mockedExe.mockResolvedValue([]);

    await scanGalleryForGifticons('u1');
    await scanGalleryForGifticons('u1');

    expect(mockedExe).toHaveBeenCalledTimes(2);
  });

  it('persists progress made before a later asset in the batch fails to save', async () => {
    await AsyncStorage.setItem('galleryImportLastCheckedAt', '500');
    mockedExe.mockResolvedValue([fakeAsset('a1', 1_000), fakeAsset('a2', 2_000)]);
    mockedRecognizeText.mockResolvedValue(ocrResult('기프티콘\n유효기간 2028.12.31까지'));
    mockedSaveGifticon.mockResolvedValueOnce('draft-1').mockRejectedValueOnce(new Error('timeout'));

    await expect(scanGalleryForGifticons('u1')).rejects.toThrow('timeout');

    // a1 succeeded before a2 threw — its id and the advanced cursor must
    // still be persisted, or the next scan re-creates a duplicate for a1.
    // a2's create never completed, so it's deliberately left off the dedupe
    // set — the next scan should retry it, not silently drop the photo.
    const storedIds = JSON.parse((await AsyncStorage.getItem('galleryImportImportedIds')) ?? '[]');
    expect(storedIds).toEqual(['a1']);
    expect(await AsyncStorage.getItem('galleryImportLastCheckedAt')).toBe('2000');
  });
});
