import { parseRecoveryPayload } from '../hooks/useDeepLinkRecovery';

describe('parseRecoveryPayload', () => {
  it('returns null for non-recovery URL', () => {
    expect(parseRecoveryPayload('https://example.com/other')).toBeNull();
    expect(parseRecoveryPayload('pulse://home')).toBeNull();
  });

  it('extracts PKCE code from query string', () => {
    const result = parseRecoveryPayload('pulse://reset-password?code=abc123def');
    expect(result).toEqual({ type: 'pkce', code: 'abc123def' });
  });

  it('decodes URL-encoded PKCE code', () => {
    const result = parseRecoveryPayload('pulse://reset-password?code=abc%3D%3D');
    expect(result).toEqual({ type: 'pkce', code: 'abc==' });
  });

  it('extracts PKCE code from &-separated query string', () => {
    const result = parseRecoveryPayload('pulse://reset-password?foo=bar&code=xyz789');
    expect(result).toEqual({ type: 'pkce', code: 'xyz789' });
  });

  it('extracts implicit tokens from hash fragment', () => {
    const url = 'pulse://reset-password#access_token=tok1&refresh_token=tok2&type=recovery';
    const result = parseRecoveryPayload(url);
    expect(result).toEqual({
      type: 'implicit',
      accessToken: 'tok1',
      refreshToken: 'tok2',
      isRecovery: true,
    });
  });

  it('marks implicit as not recovery when type != recovery', () => {
    const url = 'pulse://reset-password#access_token=tok1&refresh_token=tok2&type=signup';
    const result = parseRecoveryPayload(url);
    expect(result).toEqual({
      type: 'implicit',
      accessToken: 'tok1',
      refreshToken: 'tok2',
      isRecovery: false,
    });
  });

  it('returns null for URL with access_token but no refresh_token', () => {
    const url = 'pulse://reset-password#access_token=tok1';
    expect(parseRecoveryPayload(url)).toBeNull();
  });
});
