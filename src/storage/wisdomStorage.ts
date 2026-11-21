const STORAGE_KEY = 'neurocalm_wisdom_v1';

export function loadLatestWisdomIdFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && parsed.id.trim()) {
      return parsed.id.trim();
    }
    return null;
  } catch {
    // Graceful fallback for corrupted JSON or restricted storage
    return null;
  }
}

export function saveLatestWisdomIdToStorage(id: string): void {
  try {
    const record = {
      id: id.trim(),
      selectedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Graceful fallback for quota limits or blocked access
  }
}
