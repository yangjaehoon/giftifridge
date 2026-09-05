import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import GifticonUsagePanel from './GifticonUsagePanel';
import { confirmAsync } from '../../../shared/utils/confirmAsync';
import type { Gifticon } from '../types';

jest.mock('../../../shared/utils/confirmAsync', () => ({ confirmAsync: jest.fn() }));

const mockedConfirm = confirmAsync as jest.Mock;

function makeGifticon(overrides: Partial<Gifticon> = {}): Gifticon & { amount: number } {
  return {
    id: 'g1',
    ownerId: 'owner',
    name: '상품권',
    brand: '이마트',
    category: 'etc',
    imageUrl: 'https://example.com/x.jpg',
    expiresAt: '2099-01-01',
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    amount: 10000,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GifticonUsagePanel', () => {
  it('shows the full amount as available when nothing has been used', async () => {
    const { getByText } = await render(
      <GifticonUsagePanel
        gifticon={makeGifticon()}
        onRecordUsage={jest.fn()}
        onDeleteRecord={jest.fn()}
        busy={false}
      />,
    );
    expect(getByText('10,000원 사용 가능')).toBeTruthy();
  });

  it('shows remaining vs. total once partially used, and lists the history', async () => {
    const gifticon = makeGifticon({
      usageHistory: [{ amount: 3000, usedAt: '2026-02-01T00:00:00.000Z' }],
    });
    const { getByText } = await render(
      <GifticonUsagePanel
        gifticon={gifticon}
        onRecordUsage={jest.fn()}
        onDeleteRecord={jest.fn()}
        busy={false}
      />,
    );
    expect(getByText('7,000원 남음 / 10,000원')).toBeTruthy();
    expect(getByText('3,000원 사용')).toBeTruthy();
  });

  it('hides the add-usage button once the balance is exhausted', async () => {
    const gifticon = makeGifticon({ isUsed: true });
    const { queryByText } = await render(
      <GifticonUsagePanel
        gifticon={gifticon}
        onRecordUsage={jest.fn()}
        onDeleteRecord={jest.fn()}
        busy={false}
      />,
    );
    expect(queryByText('사용 금액 입력')).toBeNull();
  });

  it('records a valid amount and closes the form', async () => {
    const onRecordUsage = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = await render(
      <GifticonUsagePanel
        gifticon={makeGifticon()}
        onRecordUsage={onRecordUsage}
        onDeleteRecord={jest.fn()}
        busy={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('사용 금액 입력'));
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('사용한 금액'), '3000');
    });
    await act(async () => {
      fireEvent.press(getByText('등록'));
    });

    expect(onRecordUsage).toHaveBeenCalledWith(3000);
    expect(queryByPlaceholderText('사용한 금액')).toBeNull();
  });

  it('rejects an amount larger than the remaining balance without calling onRecordUsage', async () => {
    const onRecordUsage = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <GifticonUsagePanel
        gifticon={makeGifticon()}
        onRecordUsage={onRecordUsage}
        onDeleteRecord={jest.fn()}
        busy={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('사용 금액 입력'));
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('사용한 금액'), '20000');
    });
    await act(async () => {
      fireEvent.press(getByText('등록'));
    });

    expect(onRecordUsage).not.toHaveBeenCalled();
    expect(getByText(/보다 많이 입력했어요/)).toBeTruthy();
  });

  it('rejects an empty amount', async () => {
    const onRecordUsage = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <GifticonUsagePanel
        gifticon={makeGifticon()}
        onRecordUsage={onRecordUsage}
        onDeleteRecord={jest.fn()}
        busy={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('사용 금액 입력'));
    });
    await act(async () => {
      fireEvent.press(getByText('등록'));
    });

    expect(onRecordUsage).not.toHaveBeenCalled();
    expect(getByText('사용한 금액을 입력해주세요.')).toBeTruthy();
    expect(getByPlaceholderText('사용한 금액')).toBeTruthy();
  });

  it('cancel closes the form without recording anything', async () => {
    const onRecordUsage = jest.fn();
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = await render(
      <GifticonUsagePanel
        gifticon={makeGifticon()}
        onRecordUsage={onRecordUsage}
        onDeleteRecord={jest.fn()}
        busy={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('사용 금액 입력'));
    });
    expect(getByPlaceholderText('사용한 금액')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('취소'));
    });

    expect(onRecordUsage).not.toHaveBeenCalled();
    expect(queryByPlaceholderText('사용한 금액')).toBeNull();
  });

  it('deletes a record after the user confirms', async () => {
    mockedConfirm.mockResolvedValue(true);
    const onDeleteRecord = jest.fn().mockResolvedValue(undefined);
    const record = { amount: 3000, usedAt: '2026-02-01T00:00:00.000Z' };
    const gifticon = makeGifticon({ usageHistory: [record] });

    const { getByLabelText } = await render(
      <GifticonUsagePanel
        gifticon={gifticon}
        onRecordUsage={jest.fn()}
        onDeleteRecord={onDeleteRecord}
        busy={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('2026.02.01 사용 내역 삭제'));
    });

    expect(mockedConfirm).toHaveBeenCalled();
    expect(onDeleteRecord).toHaveBeenCalledWith(record);
  });

  it('does not delete when the user cancels the confirmation', async () => {
    mockedConfirm.mockResolvedValue(false);
    const onDeleteRecord = jest.fn();
    const record = { amount: 3000, usedAt: '2026-02-01T00:00:00.000Z' };
    const gifticon = makeGifticon({ usageHistory: [record] });

    const { getByLabelText } = await render(
      <GifticonUsagePanel
        gifticon={gifticon}
        onRecordUsage={jest.fn()}
        onDeleteRecord={onDeleteRecord}
        busy={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('2026.02.01 사용 내역 삭제'));
    });

    expect(onDeleteRecord).not.toHaveBeenCalled();
  });
});
