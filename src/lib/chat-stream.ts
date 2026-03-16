export interface StreamEvent {
  type: 'status' | 'tool_start' | 'tool_result' | 'chunk' | 'done' | 'error';
  message?: string;
  text?: string;
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: string;
  tool_calls?: { name: string; args: Record<string, unknown>; result: string }[];
  model_used?: string;
  provider_used?: string;
  conversationId?: string;
}

export async function sendChatStream(
  messages: { role: string; content: string }[],
  model: string,
  onEvent: (event: StreamEvent) => void,
  personality?: Record<string, string>,
  conversationId?: string | null,
  signal?: AbortSignal,
  mode?: string,
  provider?: string,
): Promise<void> {
  const body: Record<string, unknown> = { messages, model };
  if (personality) body.personality = personality;
  if (conversationId) body.conversationId = conversationId;
  if (mode) body.mode = mode;
  if (provider) body.provider = provider;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const data: StreamEvent = JSON.parse(trimmed.slice(6));
          onEvent(data);
        } catch {
          // Skip malformed events
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Request was aborted (e.g. component unmounted) — not an error
      return;
    }
    throw err;
  }
}
