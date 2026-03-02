import { useState } from 'react';
import { useExecuteCommand } from '#features/execute-command/model/use-execute-command';
import { useSSE } from '#features/subscribe-events/model/use-sse';
import { Header } from '#shared/ui/Header';
import { DeviceSidebar } from '#widgets/device-sidebar/ui/DeviceSidebar';
import { Terminal } from '#widgets/terminal/ui/Terminal';

export function DashboardPage() {
  const [selectedDaemonId, setSelectedDaemonId] = useState<string | null>(null);
  const { events } = useSSE(selectedDaemonId);
  const { execute } = useExecuteCommand(selectedDaemonId);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <DeviceSidebar selectedId={selectedDaemonId} onSelect={setSelectedDaemonId} />
        <Terminal events={events} onCommand={execute} disabled={!selectedDaemonId} />
      </div>
    </div>
  );
}
