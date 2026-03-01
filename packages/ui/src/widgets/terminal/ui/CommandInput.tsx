import { type FormEvent, useRef, useState } from 'react';

interface CommandInputProps {
  onSubmit: (command: string) => void;
  disabled: boolean;
}

export function CommandInput({ onSubmit, disabled }: CommandInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3 bg-navy-mid border-t border-navy-light"
    >
      <span className="font-mono text-gold font-bold text-sm">$</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? 'Select a daemon...' : 'Enter command...'}
        className="flex-1 font-mono text-[0.8125rem] bg-transparent border-none outline-none text-cream"
      />
    </form>
  );
}
