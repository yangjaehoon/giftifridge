import { act, renderHook } from '@testing-library/react-native';
import { useGifticonSelection } from './useGifticonSelection';

describe('useGifticonSelection', () => {
  it('starts inactive with nothing selected', async () => {
    const { result } = await renderHook(() => useGifticonSelection());
    expect(result.current.selecting).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it('begin() enters selection mode with that row picked', async () => {
    const { result } = await renderHook(() => useGifticonSelection());

    await act(async () => result.current.begin('a'));

    expect(result.current.selecting).toBe(true);
    expect(result.current.selectedIds.has('a')).toBe(true);
    expect(result.current.count).toBe(1);
  });

  it('toggle() adds and removes rows', async () => {
    const { result } = await renderHook(() => useGifticonSelection());

    await act(async () => result.current.begin('a'));
    await act(async () => result.current.toggle('b'));
    expect(result.current.count).toBe(2);

    await act(async () => result.current.toggle('a'));
    expect(result.current.selectedIds.has('a')).toBe(false);
    expect(result.current.count).toBe(1);
  });

  it('leaves selection mode when the last row is deselected', async () => {
    const { result } = await renderHook(() => useGifticonSelection());

    await act(async () => result.current.begin('a'));
    await act(async () => result.current.toggle('a'));

    expect(result.current.selecting).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it('clear() exits and empties regardless of what was selected', async () => {
    const { result } = await renderHook(() => useGifticonSelection());

    await act(async () => result.current.begin('a'));
    await act(async () => result.current.toggle('b'));
    await act(async () => result.current.clear());

    expect(result.current.selecting).toBe(false);
    expect(result.current.count).toBe(0);
  });
});
