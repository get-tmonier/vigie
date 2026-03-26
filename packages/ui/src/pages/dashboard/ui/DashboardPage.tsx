import { useState } from 'react';
import { useExecuteCommand } from '#features/execute-command/model/use-execute-command';
import { useSSE } from '#features/subscribe-events/model/use-sse';
import { useSSEDispatcher } from '#features/subscribe-events/model/use-sse-dispatcher';
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

  useSSEDispatcher(events, selectedDaemonId);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-1 bg-navy-800/50 shadow-[0_1px_0_0_rgba(22,45,74,0.8)]">
          <DeviceSelector selectedId={selectedDaemonId} onSelect={setSelectedDaemonId} />
          <div className="w-px h-4 bg-cream-200/10 shrink-0" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('sessions')}
              className={`font-body text-[0.78rem] font-medium transition-all duration-150 rounded-md px-3 py-1.5 ${
                viewMode === 'sessions'
                  ? 'text-vigie-400 bg-vigie-400/8'
                  : 'text-cream-200/60 hover:text-cream-50 hover:bg-navy-700/50'
              }`}
            >
              Sessions
            </button>
            <button
              type="button"
              onClick={() => setViewMode('terminal')}
              className={`font-body text-[0.78rem] font-medium transition-all duration-150 rounded-md px-3 py-1.5 ${
                viewMode === 'terminal'
                  ? 'text-vigie-400 bg-vigie-400/8'
                  : 'text-cream-200/60 hover:text-cream-50 hover:bg-navy-700/50'
              }`}
            >
              Terminal
            </button>
          </div>
        </div>
        {viewMode === 'sessions' ? (
          <DaemonSessionsPanel daemonId={selectedDaemonId} />
        ) : (
          <Terminal events={events} onCommand={execute} disabled={!selectedDaemonId} />
        )}
      </div>
    </div>
  );
}
