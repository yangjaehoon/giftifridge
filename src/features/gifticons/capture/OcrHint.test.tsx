import { render } from '@testing-library/react-native';
import OcrHint from './OcrHint';

describe('OcrHint', () => {
  it('renders nothing when show is false', async () => {
    const { toJSON } = await render(<OcrHint show={false} subject="상품명을" />);
    expect(toJSON()).toBeNull();
  });

  it('drops the subject into the standard sentence', async () => {
    const { getByText } = await render(<OcrHint show subject="브랜드를" />);
    expect(getByText('사진에서 브랜드를 자동으로 인식했어요. 확인해주세요.')).toBeTruthy();
  });

  it('uses message verbatim when given, ignoring subject', async () => {
    const { getByText } = await render(
      <OcrHint
        show
        subject="unused"
        message="브랜드를 보고 카테고리를 자동으로 선택했어요. 확인해주세요."
      />,
    );
    expect(getByText('브랜드를 보고 카테고리를 자동으로 선택했어요. 확인해주세요.')).toBeTruthy();
  });

  it('uses softer wording for a low-confidence guess', async () => {
    const { getByText } = await render(<OcrHint show subject="브랜드를" confident={false} />);
    expect(getByText('브랜드를 추측해서 넣었어요. 꼭 확인해주세요.')).toBeTruthy();
  });

  it('uses guessMessage for the low-confidence case when provided', async () => {
    const { getByText } = await render(
      <OcrHint show confident={false} message="확실할 때 문구" guessMessage="추측일 때 문구" />,
    );
    expect(getByText('추측일 때 문구')).toBeTruthy();
  });
});
