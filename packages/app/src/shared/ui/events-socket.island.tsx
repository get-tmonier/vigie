import { useEffect, useRef } from 'react';

type DaemonEvent =
  | { type: 'session:started'; sessionId: string; timestamp: number }
  | {
      type: 'session:ended';
      sessionId: string;
      exitCode?: number;
      resumable: boolean;
      timestamp: number;
    }
  | { type: 'session:deleted'; sessionId: string; timestamp: number }
  | { type: 'sessions:cleared'; timestamp: number }
  | { type: 'session:resumable-changed'; sessionId: string; resumable: boolean; timestamp: number }
  | { type: 'daemon:sync' }
  | { type: string };

function isTerminalVisible(): boolean {
  return document.querySelector('[data-island="terminal"]') !== null;
}

function reloadIfNoTerminal() {
  if (!isTerminalVisible()) {
    window.location.reload();
  }
}

function handleEvent(event: DaemonEvent) {
  switch (event.type) {
    case 'session:started':
      // New session appeared — reload sidebar (only if not watching a terminal)
      reloadIfNoTerminal();
      break;

    case 'session:ended': {
      const ended = event as Extract<DaemonEvent, { type: 'session:ended' }>;
      // Update all status badges for this session
      updateSessionStatusInDOM(ended.sessionId, 'ended');
      // If the terminal island is for this session, replace it with an ended message
      const terminalEl = document.querySelector<HTMLElement>(
        `[data-island="terminal"][data-session-id="${ended.sessionId}"]`
      );
      if (terminalEl) {
        terminalEl.innerHTML = '';
        terminalEl.removeAttribute('data-island');
        terminalEl.style.cssText =
          'display:flex;align-items:center;justify-content:center;height:100%;color:rgba(232,220,200,0.5);font-family:DM Sans,sans-serif;font-size:0.875rem';
        terminalEl.textContent = 'Session ended';
      }
      break;
    }

    case 'session:deleted':
    case 'sessions:cleared':
      reloadIfNoTerminal();
      break;

    case 'session:resumable-changed': {
      const resumable = event as Extract<DaemonEvent, { type: 'session:resumable-changed' }>;
      updateResumableBadgeInDOM(resumable.sessionId, resumable.resumable);
      break;
    }

    default:
      break;
  }
}

function updateSessionStatusInDOM(sessionId: string, status: 'active' | 'ended') {
  // Find all elements with data-session-status for this session
  for (const el of document.querySelectorAll<HTMLElement>(`[data-session-id="${sessionId}"]`)) {
    el.dataset.sessionStatus = status;
  }
  // Update pulse indicators (active = green pulse, ended = gray)
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-session-card="${sessionId}"] [data-status-dot]`
  )) {
    if (status === 'ended') {
      el.className = el.className
        .replace('bg-success', 'bg-cream-200/30')
        .replace('animate-pulse', '');
    }
  }
}

function updateResumableBadgeInDOM(sessionId: string, resumable: boolean) {
  const badge = document.querySelector<HTMLElement>(`[data-session-resumable="${sessionId}"]`);
  if (badge) {
    badge.style.display = resumable ? '' : 'none';
  }
}

export function EventsSocket() {
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const wsUrl = `${location.origin.replace(/^http/, 'ws')}/ws/events`;
      const ws = new WebSocket(wsUrl);

      ws.addEventListener('message', (event) => {
        if (!mountedRef.current || typeof event.data !== 'string') return;
        try {
          const data = JSON.parse(event.data) as DaemonEvent;
          handleEvent(data);
        } catch {}
      });

      ws.addEventListener('close', () => {
        if (!mountedRef.current) return;
        reconnectTimer.current = setTimeout(connect, 2000);
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, []);

  return null;
}
