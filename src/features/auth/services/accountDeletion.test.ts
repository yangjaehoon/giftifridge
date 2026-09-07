import { deleteAccount } from './accountDeletion';
import { callDeleteAccount } from '../../../lib/firebase/functions';
import { signOut } from '../../../lib/firebase/auth';

jest.mock('../../../lib/firebase/functions', () => ({ callDeleteAccount: jest.fn() }));
jest.mock('../../../lib/firebase/auth', () => ({ signOut: jest.fn() }));

const mockedCall = callDeleteAccount as jest.Mock;
const mockedSignOut = signOut as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedCall.mockResolvedValue(undefined);
  mockedSignOut.mockResolvedValue(undefined);
});

describe('deleteAccount', () => {
  it('runs the server teardown, then signs out', async () => {
    await deleteAccount();

    expect(mockedCall).toHaveBeenCalledTimes(1);
    expect(mockedSignOut).toHaveBeenCalledTimes(1);
    expect(mockedCall.mock.invocationCallOrder[0]).toBeLessThan(
      mockedSignOut.mock.invocationCallOrder[0],
    );
  });

  it('does not sign out when the server teardown fails', async () => {
    mockedCall.mockRejectedValue(new Error('internal'));

    await expect(deleteAccount()).rejects.toThrow('internal');
    expect(mockedSignOut).not.toHaveBeenCalled();
  });
});
