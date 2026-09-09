import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LocationSearchModal from './LocationSearchModal';

const candidates = [
  { coordinates: { latitude: 37.5, longitude: 127 }, label: '서울 강남구 테헤란로' },
];

async function renderModal(
  overrides: Partial<React.ComponentProps<typeof LocationSearchModal>> = {},
) {
  const props = {
    visible: true,
    query: '',
    onChangeQuery: jest.fn(),
    results: [],
    searching: false,
    onSearch: jest.fn(),
    onSelect: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  return { props, ...(await render(<LocationSearchModal {...props} />)) };
}

describe('LocationSearchModal', () => {
  it('does not render when closed', async () => {
    const { queryByText } = await renderModal({ visible: false });
    expect(queryByText('매장 위치 검색')).toBeNull();
  });

  it('reports query changes and triggers a search', async () => {
    const { props, getByText, getByPlaceholderText } = await renderModal();

    await fireEvent.changeText(getByPlaceholderText('매장 이름 또는 주소'), '강남');
    await fireEvent.press(getByText('검색'));

    expect(props.onChangeQuery).toHaveBeenCalledWith('강남');
    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });

  it('lists results and selects one on tap', async () => {
    const { props, getByText } = await renderModal({ results: candidates });

    await fireEvent.press(getByText('서울 강남구 테헤란로'));

    expect(props.onSelect).toHaveBeenCalledWith({ latitude: 37.5, longitude: 127 });
  });

  it('calls onClose from the cancel control', async () => {
    const { props, getByText } = await renderModal();

    await fireEvent.press(getByText('취소'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
