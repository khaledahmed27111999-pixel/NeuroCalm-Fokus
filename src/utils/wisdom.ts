import { WisdomMessage } from '../types/wisdom';

/**
 * Select a random wisdom message from the library while preventing consecutive repetition.
 * Fully supports small-library edge cases (1 or 2 messages).
 */
export function selectRandomWisdom(
  messages: WisdomMessage[],
  previousId?: string | null
): WisdomMessage {
  if (!messages || messages.length === 0) {
    throw new Error('Wisdom message library is empty');
  }

  if (messages.length === 1) {
    return messages[0];
  }

  // Filter out the previously displayed message
  const candidates = previousId
    ? messages.filter((m) => m.id !== previousId)
    : messages;

  const pool = candidates.length > 0 ? candidates : messages;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Retrieve a message by ID.
 */
export function getWisdomById(
  messages: WisdomMessage[],
  id: string
): WisdomMessage | undefined {
  return messages.find((m) => m.id === id);
}

/**
 * Get the calm default wisdom message for the application.
 */
export function getDefaultWisdom(messages: WisdomMessage[]): WisdomMessage {
  if (!messages || messages.length === 0) {
    throw new Error('Wisdom message library is empty');
  }
  return messages[0];
}
