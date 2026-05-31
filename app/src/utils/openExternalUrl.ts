import * as WebBrowser from 'expo-web-browser';

/** Only http(s) URLs are handed to the system browser. */
const SAFE_PROTOCOL = /^https?:$/i;

/**
 * Opens a (possibly untrusted) digest URL in the system browser, but only when
 * it parses as an http/https URL. Any other scheme — or an unparseable string —
 * is ignored, so hostile `intent://`/`javascript:`/`file:` URLs never reach the
 * OS `ACTION_VIEW` resolver.
 */
export function openExternalUrl(url: string, options?: WebBrowser.WebBrowserOpenOptions): void {
  try {
    if (!SAFE_PROTOCOL.test(new URL(url).protocol)) return;
  } catch {
    return;
  }
  if (options) {
    void WebBrowser.openBrowserAsync(url, options);
  } else {
    void WebBrowser.openBrowserAsync(url);
  }
}
