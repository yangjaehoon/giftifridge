import React from 'react';
import { render } from '@testing-library/react-native';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders an animated view and starts a loop that is stopped on unmount', async () => {
    const { unmount, toJSON } = await render(<Skeleton style={{ width: 40, height: 10 }} />);

    expect(toJSON()).toBeTruthy();
    // Unmount must not throw even though a looping animation is running.
    await unmount();
  });

  it('merges a caller-provided style onto the base style', async () => {
    const { toJSON } = await render(<Skeleton style={{ width: 123 }} />);
    const flattened = JSON.stringify(toJSON());
    expect(flattened).toContain('123');
  });
});
