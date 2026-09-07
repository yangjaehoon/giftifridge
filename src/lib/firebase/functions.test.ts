/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('firebase/app', () => ({ getApp: jest.fn(() => ({ name: 'app' })) }));
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({ type: 'functions' })),
  httpsCallable: jest.fn(),
}));

type AppMock = { getApp: jest.Mock };
type FunctionsMock = { getFunctions: jest.Mock; httpsCallable: jest.Mock };

function load() {
  const app = require('firebase/app') as AppMock;
  const functions = require('firebase/functions') as FunctionsMock;
  const mod = require('./functions') as typeof import('./functions');
  return { app, functions, mod };
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('callDeleteAccount', () => {
  it('gets Functions for the deployed region and invokes the deleteAccount callable', async () => {
    const { app, functions, mod } = load();
    const invoke = jest.fn().mockResolvedValue({ data: { ok: true } });
    functions.httpsCallable.mockReturnValue(invoke);

    await expect(mod.callDeleteAccount()).resolves.toBeUndefined();

    expect(functions.getFunctions).toHaveBeenCalledWith({ name: 'app' }, 'asia-northeast3');
    expect(functions.httpsCallable).toHaveBeenCalledWith({ type: 'functions' }, 'deleteAccount');
    expect(invoke).toHaveBeenCalledWith();
    expect(app.getApp).toHaveBeenCalled();
  });

  it('rejects when the callable rejects', async () => {
    const { functions, mod } = load();
    functions.httpsCallable.mockReturnValue(jest.fn().mockRejectedValue(new Error('internal')));

    await expect(mod.callDeleteAccount()).rejects.toThrow('internal');
  });
});
