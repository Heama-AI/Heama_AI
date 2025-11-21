export function snippet(text: string, limit = 80) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}
