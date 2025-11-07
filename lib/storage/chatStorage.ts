import { getDatabase } from '@/lib/database';
import type { ChatMessage } from '@/types/chat';

type ChatRow = {
  id: string;
  role: string;
  text: string;
  ts: number;
};

export async function loadChatMessages(): Promise<ChatMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ChatRow>('SELECT * FROM chat_messages ORDER BY ts ASC, id ASC');
  return rows.map((row) => ({
    id: row.id,
    role: row.role as ChatMessage['role'],
    text: row.text,
    ts: row.ts,
  }));
}

export async function saveChatMessage(message: ChatMessage) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO chat_messages (id, role, text, ts) VALUES ($id, $role, $text, $ts)`,
    {
      $id: message.id,
      $role: message.role,
      $text: message.text,
      $ts: message.ts,
    },
  );
}

export async function overwriteChatMessages(messages: ChatMessage[]) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM chat_messages');
    for (const message of messages) {
      await txn.runAsync(
        `INSERT INTO chat_messages (id, role, text, ts) VALUES ($id, $role, $text, $ts)`,
        {
          $id: message.id,
          $role: message.role,
          $text: message.text,
          $ts: message.ts,
        },
      );
    }
  });
}

export async function clearChatMessages() {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM chat_messages');
}
