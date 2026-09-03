import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ToastProvider, useToast } from './ToastProvider';

function Trigger({ message = '저장되었어요' }: { message?: string }) {
  const showToast = useToast();
  return <Button title="go" onPress={() => showToast(message)} />;
}

describe('ToastProvider', () => {
  it('shows a message on showToast and hides it after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const { getByText, queryByText } = await render(
        <ToastProvider>
          <Trigger />
        </ToastProvider>,
      );

      expect(queryByText('저장되었어요')).toBeNull();

      await act(async () => {
        fireEvent.press(getByText('go'));
      });
      expect(getByText('저장되었어요')).toBeTruthy();

      await act(async () => {
        jest.runAllTimers();
      });
      expect(queryByText('저장되었어요')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('is a no-op (no throw) when used outside a provider', async () => {
    const { getByText } = await render(<Trigger />);
    await act(async () => {
      fireEvent.press(getByText('go'));
    });
    // nothing to assert beyond "did not throw"
    expect(getByText('go')).toBeTruthy();
  });

  it('replaces the current message when called again', async () => {
    jest.useFakeTimers();
    try {
      function Two() {
        const showToast = useToast();
        return (
          <>
            <Text onPress={() => showToast('첫번째')}>a</Text>
            <Text onPress={() => showToast('두번째')}>b</Text>
          </>
        );
      }
      const { getByText, queryByText } = await render(
        <ToastProvider>
          <Two />
        </ToastProvider>,
      );

      await act(async () => fireEvent.press(getByText('a')));
      await act(async () => fireEvent.press(getByText('b')));

      expect(getByText('두번째')).toBeTruthy();
      expect(queryByText('첫번째')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
