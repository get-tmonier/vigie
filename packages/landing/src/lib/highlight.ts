export function hl(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>');
}
