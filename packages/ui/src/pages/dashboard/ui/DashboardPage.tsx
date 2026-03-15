import { useState } from 'react';
import { useExecuteCommand } from '#features/execute-command/model/use-execute-command';
import { useSSE } from '#features/subscribe-events/model/use-sse';
import { Header } from '#shared/ui/Header';
import { DaemonSessionsPanel } from '#widgets/daemon-sessions/ui/DaemonSessionsPanel';
import { DeviceSelector } from '#widgets/device-selector/ui/DeviceSelector';
import { Terminal } from '#widgets/terminal/ui/Terminal';

type ViewMode = 'terminal' | 'sessions';

export function DashboardPage() {
  const [selectedDaemonId, setSelectedDaemonId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const { events } = useSSE(selectedDaemonId);
  const { execute } = useExecuteCommand(selectedDaemonId);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b border-navy-light">
          <DeviceSelector selectedId={selectedDaemonId} onSelect={setSelectedDaemonId} />
          <div className="w-px h-5 bg-navy-light mx-1" />
          <button
            type="button"
            onClick={() => setViewMode('sessions')}
            className={`px-4 py-2 text-sm ${
              viewMode === 'sessions'
                ? 'text-gold border-b-2 border-gold'
                : 'text-slate hover:text-cream'
            }`}
          >
            Sessions
          </button>
          <button
            type="button"
            onClick={() => setViewMode('terminal')}
            className={`px-4 py-2 text-sm ${
              viewMode === 'terminal'
                ? 'text-gold border-b-2 border-gold'
                : 'text-slate hover:text-cream'
            }`}
          >
            Terminal
          </button>
        </div>
        {viewMode === 'sessions' ? (
          <DaemonSessionsPanel daemonId={selectedDaemonId} events={events} />
        ) : (
          <Terminal events={events} onCommand={execute} disabled={!selectedDaemonId} />
        )}
      </div>
    </div>
  );
}
