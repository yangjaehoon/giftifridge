import React from 'react';
import { render } from '@testing-library/react-native';
import SpaceMembersSkeleton from './SpaceMembersSkeleton';

describe('SpaceMembersSkeleton', () => {
  it('renders its placeholder layout without crashing', async () => {
    const { toJSON } = await render(<SpaceMembersSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});
