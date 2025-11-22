import type { ChatMessage } from '@/types/chat';

function chunkWithOverlap(text: string, chunkSize = 450, overlap = 80) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

export function buildConversationText(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? '사용자' : '해마'}: ${m.text}`)
    .join('\n');
}

export function chunkMessages(messages: ChatMessage[], chunkSize = 450, overlap = 80) {
  const fullText = buildConversationText(messages);
  return chunkWithOverlap(fullText, chunkSize, overlap);
}
