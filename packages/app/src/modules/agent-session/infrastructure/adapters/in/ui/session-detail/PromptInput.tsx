import { useState } from 'react';

interface PromptInputProps {
  sessionId: string;
  disabled: boolean;
}

export function PromptInput({ sessionId, disabled }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || disabled || sending) return;
    setSending(true);
    try {
      await fetch(`/api/sessions/${sessionId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      setPrompt('');
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-neutral-700">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={disabled ? 'Session running...' : 'Send next prompt...'}
        disabled={disabled || sending}
        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-teal-600 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || sending || !prompt.trim()}
        className="px-4 py-2 bg-teal-700 text-sm text-white rounded hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}
