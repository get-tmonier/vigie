import { createRoot } from 'react-dom/client';
import { InteractiveTerminal } from '#modules/terminal/adapters/primary/ui/InteractiveTerminal.island.js';
import { EventsSocket } from '#shared/events-socket.island.js';
import '#shared/styles/global.css';

// Mount terminal islands
for (const el of document.querySelectorAll<HTMLElement>('[data-island="terminal"]')) {
  const sessionId = el.dataset.sessionId;
  if (!sessionId) continue;
  createRoot(el).render(<InteractiveTerminal sessionId={sessionId} />);
}

// Mount events socket island
const eventsSocketEl = document.getElementById('events-socket');
if (eventsSocketEl) {
  createRoot(eventsSocketEl).render(<EventsSocket />);
}
