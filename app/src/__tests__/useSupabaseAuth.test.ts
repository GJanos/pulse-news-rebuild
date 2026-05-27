import {
  signIn,
  signUp,
  resetPassword,
  updatePassword,
  deleteAccount,
} from '../hooks/useSupabaseAuth';
import { useAppStore } from '../store';

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockRpc = jest.fn();

const mockClient = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
  },
  rpc: mockRpc,
};

jest.mock('../supabase/client', () => ({ getSupabase: jest.fn() }));
jest.mock('../storage/mmkv', () => ({ storage: { clearAll: jest.fn() } }));
jest.mock('../logger', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../hooks/useDeepLinkRecovery', () => ({ useDeepLinkRecovery: jest.fn() }));

const { getSupabase } = require('../supabase/client') as { getSupabase: jest.Mock };
const { storage } = require('../storage/mmkv') as { storage: { clearAll: jest.Mock } };

beforeEach(() => {
  jest.clearAllMocks();
  getSupabase.mockReturnValue(mockClient);
  useAppStore.setState({ session: null, authReady: false, isPasswordRecovery: false });
});

describe('signIn', () => {
  it('returns null on success', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    expect(await signIn('a@b.com', 'pass')).toBeNull();
  });

  it('returns error message on failure', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    expect(await signIn('a@b.com', 'wrong')).toBe('Invalid credentials');
  });

  it('returns configured error when supabase is null', async () => {
    getSupabase.mockReturnValue(null);
    expect(await signIn('a@b.com', 'pass')).toBe('Supabase not configured');
  });
});

describe('signUp', () => {
  it('returns needsConfirmation when no session returned', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await signUp('a@b.com', 'pass123');
    expect(result).toEqual({ error: null, needsConfirmation: true });
  });

  it('returns error on failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Already registered' },
    });
    const result = await signUp('a@b.com', 'pass');
    expect(result).toEqual({ error: 'Already registered', needsConfirmation: false });
  });

  it('returns success with session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    const result = await signUp('a@b.com', 'pass123');
    expect(result).toEqual({ error: null, needsConfirmation: false });
  });
});

describe('resetPassword', () => {
  it('returns null on success', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await resetPassword('a@b.com')).toBeNull();
  });

  it('passes redirectTo pulse://reset-password', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    await resetPassword('a@b.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('a@b.com', {
      redirectTo: 'pulse://reset-password',
    });
  });

  it('returns error message on failure', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Not found' } });
    expect(await resetPassword('a@b.com')).toBe('Not found');
  });
});

describe('updatePassword', () => {
  it('returns null and clears isPasswordRecovery on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    useAppStore.setState({ isPasswordRecovery: true });
    expect(await updatePassword('newpass123')).toBeNull();
    expect(useAppStore.getState().isPasswordRecovery).toBe(false);
  });

  it('returns error and keeps isPasswordRecovery on failure', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Weak password' } });
    useAppStore.setState({ isPasswordRecovery: true });
    expect(await updatePassword('weak')).toBe('Weak password');
    expect(useAppStore.getState().isPasswordRecovery).toBe(true);
  });
});

describe('deleteAccount', () => {
  it('calls rpc, clears storage, signs out, returns null', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    expect(await deleteAccount()).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('delete_my_account');
    expect(storage.clearAll).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('returns error without wiping if rpc fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'RPC failed' } });
    expect(await deleteAccount()).toBe('RPC failed');
    expect(storage.clearAll).not.toHaveBeenCalled();
  });
});
