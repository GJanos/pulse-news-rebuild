/** Strips Perplexity citation markers ([1], [1][2], etc.) and collapses extra whitespace. */
export function stripCitations(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Returns true when the summary contains an inline hyperlink (Perplexity embeds these occasionally). */
export function summaryHasUrl(summary: string): boolean {
  return /https?:\/\//.test(summary);
}
