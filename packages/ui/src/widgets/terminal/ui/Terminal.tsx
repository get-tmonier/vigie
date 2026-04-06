import type { DaemonEvent } from '#shared/types/daemon-event';
import { CommandInput } from './CommandInput';
import { TerminalOutput } from './TerminalOutput';

interface TerminalProps {
  events: DaemonEvent[];
  onCommand: (command: string) => void;
  disabled: boolean;
}

export function Terminal({ events, onCommand, disabled }: TerminalProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TerminalOutput events={events} />
      <CommandInput onSubmit={onCommand} disabled={disabled} />
    </div>
  );
}
