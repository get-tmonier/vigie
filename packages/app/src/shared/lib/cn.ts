import { twMerge } from 'tailwind-merge';

export function cn(...classes: (string | false | undefined | null | 0)[]) {
  return twMerge(classes.filter(Boolean) as string[]);
}
