function sanitize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^0-9a-zA-Z가-힣\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function calculateScriptMatch(transcript: string, prompt: string) {
  const promptTokens = sanitize(prompt);
  if (promptTokens.length === 0) {
    return { matchCount: 0, totalCount: 0, ratio: 0 };
  }

  const spokenTokens = sanitize(transcript);
  const spokenSet = new Set(spokenTokens);
  const matchCount = promptTokens.filter((token) => spokenSet.has(token)).length;
  const ratio = matchCount / promptTokens.length;

  return {
    matchCount,
    totalCount: promptTokens.length,
    ratio,
  };
}
