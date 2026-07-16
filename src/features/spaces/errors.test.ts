import { getSpaceErrorMessage } from './errors';

describe('getSpaceErrorMessage', () => {
  it('returns a distinct message per action', () => {
    const create = getSpaceErrorMessage('create');
    const join = getSpaceErrorMessage('join');
    const leave = getSpaceErrorMessage('leave');

    expect(create).toMatch(/만들지/);
    expect(join).toMatch(/참여/);
    expect(leave).toMatch(/나가지/);
    expect(new Set([create, join, leave]).size).toBe(3);
  });
});
