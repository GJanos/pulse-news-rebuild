import * as WebBrowser from 'expo-web-browser';
import { openExternalUrl } from '../../utils/openExternalUrl';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('openExternalUrl', () => {
  it('opens http urls', () => {
    openExternalUrl('http://example.com/a');
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('http://example.com/a');
  });

  it('opens https urls and forwards options', () => {
    openExternalUrl('https://example.com/a', { showInRecents: false });
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com/a', {
      showInRecents: false,
    });
  });

  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'intent://scan/#Intent;scheme=zxing;end',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/x',
  ])('ignores non-http(s) scheme %s', (url) => {
    openExternalUrl(url);
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('ignores an unparseable url', () => {
    openExternalUrl('not a url');
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});
