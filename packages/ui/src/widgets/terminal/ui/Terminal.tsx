import type { SSEEvent } from '@tmonier/shared';
import { CommandInput } from './CommandInput';
import { TerminalOutput } from './TerminalOutput';

interface TerminalProps {
  events: SSEEvent[];
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
