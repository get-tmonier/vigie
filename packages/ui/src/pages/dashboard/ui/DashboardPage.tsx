import { useState } from 'react';
import { useExecuteCommand } from '../../../features/execute-command/model/use-execute-command.js';
import { useSSE } from '../../../features/subscribe-events/model/use-sse.js';
import { Header } from '../../../shared/ui/Header.js';
import { DaemonSidebar } from '../../../widgets/daemon-sidebar/ui/DaemonSidebar.js';
import { Terminal } from '../../../widgets/terminal/ui/Terminal.js';

export function DashboardPage() {
  const [selectedDaemonId, setSelectedDaemonId] = useState<string | null>(null);
  const { events } = useSSE(selectedDaemonId);
  const { execute } = useExecuteCommand(selectedDaemonId);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <DaemonSidebar selectedId={selectedDaemonId} onSelect={setSelectedDaemonId} />
        <Terminal events={events} onCommand={execute} disabled={!selectedDaemonId} />
      </div>
    </div>
  );
}
