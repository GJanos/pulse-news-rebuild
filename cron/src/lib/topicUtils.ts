export function tokenise(text: string): string[] {
  return (text.toLowerCase().match(/\w+/g) ?? []).filter((w) => w.length >= 4);
}

export function topicWords(title: string): Set<string> {
  return new Set(tokenise(title));
}

export function isDuplicateTopic(title: string, seen: { title: string }[]): boolean {
  const words = topicWords(title);
  if (words.size === 0) return false;
  for (const h of seen) {
    const hWords = topicWords(h.title);
    const intersection = [...words].filter((w) => hWords.has(w)).length;
    if (intersection < 2) continue;
    if (intersection / new Set([...words, ...hWords]).size >= 0.4) return true;
  }
  return false;
}

export function calcAvgTopicSpread(headlines: { title: string }[]): number {
  if (headlines.length < 2) return 1;
  let totalSimilarity = 0;
  let pairs = 0;
  for (let i = 0; i < headlines.length; i++) {
    const wi = topicWords(headlines[i]!.title);
    for (let j = i + 1; j < headlines.length; j++) {
      const wj = topicWords(headlines[j]!.title);
      const union = new Set([...wi, ...wj]).size;
      const intersection = [...wi].filter((w) => wj.has(w)).length;
      totalSimilarity += union === 0 ? 0 : intersection / union;
      pairs++;
    }
  }
  return 1 - totalSimilarity / pairs;
}
