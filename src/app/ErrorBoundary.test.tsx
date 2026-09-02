import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import ErrorBoundary from './ErrorBoundary';

// Flipped between renders so pressing "다시 시도" can actually recover.
let shouldCrash = true;

function Boom(): React.ReactElement {
  if (shouldCrash) throw new Error('render blew up');
  return <Text>정상 화면</Text>;
}

describe('ErrorBoundary', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    shouldCrash = true;
    // React logs the caught error to console.error; keep the test output clean.
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders its children while they do not throw', async () => {
    shouldCrash = false;
    const { getByText } = await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(getByText('정상 화면')).toBeTruthy();
  });

  it('shows the fallback UI after a child throws during render', async () => {
    const { getByText } = await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(getByText('문제가 발생했어요')).toBeTruthy();
  });

  it('clears the error and re-renders children when "다시 시도" is pressed', async () => {
    const { getByText, queryByText } = await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    shouldCrash = false;
    await act(async () => {
      fireEvent.press(getByText('다시 시도'));
    });

    expect(queryByText('문제가 발생했어요')).toBeNull();
    expect(getByText('정상 화면')).toBeTruthy();
  });
});
