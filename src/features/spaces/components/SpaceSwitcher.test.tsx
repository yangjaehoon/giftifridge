import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SpaceSwitcher from './SpaceSwitcher';
import type { Space } from '../types';

function makeSpace(id: string, name: string): Space {
  return { id, name, ownerId: 'owner', createdAt: 't' };
}

describe('SpaceSwitcher', () => {
  const spaces = [makeSpace('s1', '우리집'), makeSpace('s2', '회사')];

  it('renders the personal chip plus one chip per space', async () => {
    const { getByText } = await render(
      <SpaceSwitcher
        spaces={spaces}
        selected={{ type: 'personal' }}
        onSelect={jest.fn()}
        onCreatePress={jest.fn()}
      />,
    );

    expect(getByText('내 기프티콘')).toBeTruthy();
    expect(getByText('우리집')).toBeTruthy();
    expect(getByText('회사')).toBeTruthy();
  });

  it('selects the personal context when the first chip is pressed', async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(
      <SpaceSwitcher
        spaces={spaces}
        selected={{ type: 'space', spaceId: 's1' }}
        onSelect={onSelect}
        onCreatePress={jest.fn()}
      />,
    );

    fireEvent.press(getByText('내 기프티콘'));
    expect(onSelect).toHaveBeenCalledWith({ type: 'personal' });
  });

  it('selects a space context with its id when a space chip is pressed', async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(
      <SpaceSwitcher
        spaces={spaces}
        selected={{ type: 'personal' }}
        onSelect={onSelect}
        onCreatePress={jest.fn()}
      />,
    );

    fireEvent.press(getByText('회사'));
    expect(onSelect).toHaveBeenCalledWith({ type: 'space', spaceId: 's2' });
  });

  it('invokes onCreatePress from the trailing "+" chip', async () => {
    const onCreatePress = jest.fn();
    const { getByLabelText } = await render(
      <SpaceSwitcher
        spaces={spaces}
        selected={{ type: 'personal' }}
        onSelect={jest.fn()}
        onCreatePress={onCreatePress}
      />,
    );

    fireEvent.press(getByLabelText('새 스페이스 만들기'));
    expect(onCreatePress).toHaveBeenCalledTimes(1);
  });
});
