import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useGifticonForm } from './useGifticonForm';
import type { Gifticon } from '../types';

const existing: Gifticon = {
  id: 'g1',
  ownerId: 'u1',
  name: '기존아메리카노',
  brand: '기존스타벅스',
  category: 'convenience',
  imageUrl: 'https://storage/gifticons/g1.jpg',
  expiresAt: '2027-03-04',
  isUsed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  amount: 5000,
  barcode: '8801234',
  location: { latitude: 1, longitude: 2 },
  memo: '엄마가 준 것',
};

describe('useGifticonForm', () => {
  it('starts blank on the create path', async () => {
    const { result } = await renderHook(() => useGifticonForm(undefined, false));

    expect(result.current.hydrated).toBe(true);
    expect(result.current.name).toBe('');
    expect(result.current.imageUri).toBeNull();
    expect(result.current.category).toBe('cafe');
  });

  it('hydrates every field from an existing gifticon on the edit path', async () => {
    const { result } = await renderHook(() => useGifticonForm(existing, true));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.name).toBe('기존아메리카노');
    expect(result.current.brand).toBe('기존스타벅스');
    expect(result.current.amount).toBe('5000');
    expect(result.current.category).toBe('convenience');
    expect(result.current.barcode).toBe('8801234');
    expect(result.current.imageUri).toBe('https://storage/gifticons/g1.jpg');
    expect(result.current.originalImageUrl).toBe('https://storage/gifticons/g1.jpg');
    expect(result.current.location).toEqual({ latitude: 1, longitude: 2 });
    expect(result.current.memo).toBe('엄마가 준 것');
  });

  it('hydrates a real saved amount of 0, not as blank', async () => {
    const { result } = await renderHook(() => useGifticonForm({ ...existing, amount: 0 }, true));

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.amount).toBe('0');
  });

  it('validate() flags missing image/name/brand and returns false', async () => {
    const { result } = await renderHook(() => useGifticonForm(undefined, false));

    let ok = true;
    await act(async () => {
      ok = result.current.validate();
    });

    expect(ok).toBe(false);
    expect(result.current.fieldErrors).toEqual({
      image: '기프티콘 사진을 등록해주세요.',
      name: '상품명을 입력해주세요.',
      brand: '브랜드를 입력해주세요.',
    });
  });

  it('editing a field clears just that field error', async () => {
    const { result } = await renderHook(() => useGifticonForm(undefined, false));
    await act(async () => result.current.validate());

    await act(async () => result.current.setName('아메리카노'));

    expect(result.current.fieldErrors.name).toBeUndefined();
    expect(result.current.fieldErrors.brand).toBe('브랜드를 입력해주세요.');
  });

  it('validate() passes and buildFields() assembles a trimmed payload', async () => {
    const { result } = await renderHook(() => useGifticonForm(undefined, false));

    await act(async () => {
      result.current.setImage('file:///photo.jpg');
      result.current.setName('  아메리카노  ');
      result.current.setBrand('스타벅스');
      result.current.setAmount('4500');
      result.current.setCategory('cafe');
      result.current.setMemo('  회사 탕비실용  ');
    });

    let ok = false;
    await act(async () => {
      ok = result.current.validate();
    });
    expect(ok).toBe(true);

    const fields = result.current.buildFields();
    expect(fields).toMatchObject({ name: '아메리카노', brand: '스타벅스', amount: 4500 });
    expect(fields.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fields.barcode).toBeUndefined();
    expect(fields.memo).toBe('회사 탕비실용');
  });

  it('buildFields() omits an empty memo', async () => {
    const { result } = await renderHook(() => useGifticonForm(undefined, false));

    await act(async () => result.current.setMemo('   '));

    expect(result.current.buildFields().memo).toBeUndefined();
  });

  describe('field-claim tracking (isFieldEdited / setX vs detectX)', () => {
    it('claims nothing on the create path until the user edits', async () => {
      const { result } = await renderHook(() => useGifticonForm(undefined, false));

      for (const field of [
        'name',
        'brand',
        'amount',
        'category',
        'barcode',
        'expiresAt',
      ] as const) {
        expect(result.current.isFieldEdited(field)).toBe(false);
      }
    });

    it('setX claims the field; detectX writes the same value without claiming it', async () => {
      const { result } = await renderHook(() => useGifticonForm(undefined, false));

      await act(async () => result.current.detectName('아메리카노'));
      expect(result.current.name).toBe('아메리카노');
      expect(result.current.isFieldEdited('name')).toBe(false);

      await act(async () => result.current.setName('내가 입력'));
      expect(result.current.name).toBe('내가 입력');
      expect(result.current.isFieldEdited('name')).toBe(true);
    });

    it('detectExpiresAt vs setExpiresAt track the claim the same way', async () => {
      const { result } = await renderHook(() => useGifticonForm(undefined, false));

      await act(async () => result.current.detectExpiresAt(new Date(2027, 0, 2)));
      expect(result.current.isFieldEdited('expiresAt')).toBe(false);

      await act(async () => result.current.setExpiresAt(new Date(2027, 5, 6)));
      expect(result.current.expiresAt.getFullYear()).toBe(2027);
      expect(result.current.isFieldEdited('expiresAt')).toBe(true);
    });

    it('detectName still clears a standing inline error', async () => {
      const { result } = await renderHook(() => useGifticonForm(undefined, false));
      await act(async () => result.current.validate());
      expect(result.current.fieldErrors.name).toBeDefined();

      await act(async () => result.current.detectName('아메리카노'));
      expect(result.current.fieldErrors.name).toBeUndefined();
    });

    it('editing an existing gifticon pre-claims name/brand/category/expiry', async () => {
      const { result } = await renderHook(() => useGifticonForm(existing, true));
      await waitFor(() => expect(result.current.hydrated).toBe(true));

      expect(result.current.isFieldEdited('name')).toBe(true);
      expect(result.current.isFieldEdited('brand')).toBe(true);
      expect(result.current.isFieldEdited('category')).toBe(true);
      expect(result.current.isFieldEdited('expiresAt')).toBe(true);
    });

    it('pre-claims barcode/amount only when the gifticon actually has one', async () => {
      const { result } = await renderHook(() =>
        useGifticonForm({ ...existing, barcode: undefined, amount: undefined }, true),
      );
      await waitFor(() => expect(result.current.hydrated).toBe(true));

      expect(result.current.isFieldEdited('barcode')).toBe(false);
      expect(result.current.isFieldEdited('amount')).toBe(false);
    });

    it('pre-claims a real saved amount of 0 (not just a truthy one)', async () => {
      const { result } = await renderHook(() => useGifticonForm({ ...existing, amount: 0 }, true));
      await waitFor(() => expect(result.current.hydrated).toBe(true));

      expect(result.current.isFieldEdited('amount')).toBe(true);
    });
  });
});
