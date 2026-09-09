import TextRecognition from '@react-native-ml-kit/text-recognition';
import { recognizeText } from './recognize';

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn() },
  TextRecognitionScript: { KOREAN: 'korean', LATIN: 'latin' },
}));
// The pre-OCR upscale step has its own test (prepareImage.test.ts); here it's
// a pass-through so the recognize assertions stay about recognition.
jest.mock('./prepareImage', () => ({
  prepareImageForOcr: jest.fn((uri: string) => Promise.resolve(uri)),
}));

const mockedRecognize = TextRecognition.recognize as jest.Mock;

describe('recognizeText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs OCR with the Korean script and returns the text with each line's height", async () => {
    mockedRecognize.mockResolvedValue({
      text: '스타벅스\n아메리카노 Tall',
      blocks: [
        {
          text: '스타벅스\n아메리카노 Tall',
          lines: [
            { text: '스타벅스', frame: { top: 0, left: 0, width: 100, height: 40 } },
            { text: '아메리카노 Tall', frame: { top: 40, left: 0, width: 120, height: 30 } },
          ],
        },
      ],
    });

    await expect(recognizeText('file:///gifticon.jpg')).resolves.toEqual({
      text: '스타벅스\n아메리카노 Tall',
      lines: [
        { text: '스타벅스', height: 40 },
        { text: '아메리카노 Tall', height: 30 },
      ],
    });
    expect(mockedRecognize).toHaveBeenCalledWith('file:///gifticon.jpg', 'korean');
  });

  it("defaults a line's height to 0 when it has no frame", async () => {
    mockedRecognize.mockResolvedValue({
      text: '스타벅스',
      blocks: [{ text: '스타벅스', lines: [{ text: '스타벅스' }] }],
    });

    await expect(recognizeText('file:///gifticon.jpg')).resolves.toEqual({
      text: '스타벅스',
      lines: [{ text: '스타벅스', height: 0 }],
    });
  });

  it('returns null when OCR throws', async () => {
    mockedRecognize.mockRejectedValue(new Error('ml kit unavailable'));

    await expect(recognizeText('file:///gifticon.jpg')).resolves.toBeNull();
  });

  it('still returns the raw text if a build ever reports text with no matching blocks', async () => {
    mockedRecognize.mockResolvedValue({ text: '유효기간 2026.03.15', blocks: undefined });

    await expect(recognizeText('file:///gifticon.jpg')).resolves.toEqual({
      text: '유효기간 2026.03.15',
      lines: [],
    });
  });

  it('skips the Latin pass when the Korean result is already rich', async () => {
    const rich = {
      text: '스타벅스\n아메리카노 Tall\n교환처 전국 스타벅스 매장\n유효기간 2026.12.31까지',
      blocks: [
        {
          lines: [
            { text: '스타벅스' },
            { text: '아메리카노 Tall' },
            { text: '교환처 전국 스타벅스 매장' },
            { text: '유효기간 2026.12.31까지' },
          ],
        },
      ],
    };
    mockedRecognize.mockResolvedValue(rich);

    await recognizeText('file:///gifticon.jpg');

    expect(mockedRecognize).toHaveBeenCalledTimes(1);
    expect(mockedRecognize).toHaveBeenCalledWith('file:///gifticon.jpg', 'korean');
  });

  it('runs a Latin pass and merges in lines the Korean pass missed when it came back sparse', async () => {
    mockedRecognize.mockImplementation((_uri: string, script: string) =>
      Promise.resolve(
        script === 'korean'
          ? { text: '유효기간 2027.01.31', blocks: [{ lines: [{ text: '유효기간 2027.01.31' }] }] }
          : {
              text: 'TOUS les JOURS\nCHOCOLATE CAKE',
              blocks: [{ lines: [{ text: 'TOUS les JOURS' }, { text: 'CHOCOLATE CAKE' }] }],
            },
      ),
    );

    const result = await recognizeText('file:///gifticon.jpg');

    expect(mockedRecognize).toHaveBeenCalledWith('file:///gifticon.jpg', 'latin');
    expect(result?.text).toBe('유효기간 2027.01.31\nTOUS les JOURS\nCHOCOLATE CAKE');
    expect(result?.lines.map((l) => l.text)).toEqual([
      '유효기간 2027.01.31',
      'TOUS les JOURS',
      'CHOCOLATE CAKE',
    ]);
  });

  it('keeps the Korean result if the Latin pass throws', async () => {
    mockedRecognize.mockImplementation((_uri: string, script: string) =>
      script === 'korean'
        ? Promise.resolve({
            text: '유효기간 2027.01.31',
            blocks: [{ lines: [{ text: '유효기간 2027.01.31' }] }],
          })
        : Promise.reject(new Error('latin model not downloaded')),
    );

    await expect(recognizeText('file:///gifticon.jpg')).resolves.toEqual({
      text: '유효기간 2027.01.31',
      lines: [{ text: '유효기간 2027.01.31', height: 0 }],
    });
  });
});
