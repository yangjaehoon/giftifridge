import TextRecognition from '@react-native-ml-kit/text-recognition';
import { recognizeText } from './recognize';

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn() },
  TextRecognitionScript: { KOREAN: 'korean' },
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
});
