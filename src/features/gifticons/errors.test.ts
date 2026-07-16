import { getGifticonErrorMessage } from './errors';

describe('getGifticonErrorMessage', () => {
  it('returns a distinct message per action', () => {
    const save = getGifticonErrorMessage('save');
    const update = getGifticonErrorMessage('update');
    const del = getGifticonErrorMessage('delete');

    expect(save).toMatch(/저장/);
    expect(update).toMatch(/처리/);
    expect(del).toMatch(/삭제/);
    expect(new Set([save, update, del]).size).toBe(3);
  });
});
