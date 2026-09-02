import { Alert } from 'react-native';
import { confirmAsync } from './confirmAsync';

type Button = { text: string; onPress?: () => void };

function lastButtons(): Button[] {
  return (Alert.alert as jest.Mock).mock.calls.at(-1)![2] as Button[];
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('confirmAsync', () => {
  it('resolves true when the confirm button is pressed', async () => {
    const promise = confirmAsync('제목', '내용');
    lastButtons().find((b) => b.text === '계속')!.onPress!();
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false when cancelled', async () => {
    const promise = confirmAsync('제목', '내용');
    lastButtons().find((b) => b.text === '취소')!.onPress!();
    await expect(promise).resolves.toBe(false);
  });

  it('honours a custom confirm label', async () => {
    const promise = confirmAsync('제목', '내용', '삭제');
    const labels = lastButtons().map((b) => b.text);
    expect(labels).toEqual(['취소', '삭제']);
    lastButtons().find((b) => b.text === '삭제')!.onPress!();
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false when the dialog is dismissed', async () => {
    const promise = confirmAsync('제목', '내용');
    const opts = (Alert.alert as jest.Mock).mock.calls.at(-1)![3] as { onDismiss?: () => void };
    opts.onDismiss!();
    await expect(promise).resolves.toBe(false);
  });
});
