import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LUNAR_DAYS = 354;

export const isDue = (date: string) => {
  const acquired = new Date(date);
  const elapsed = (Date.now() - acquired.getTime()) / (1000 * 60 * 60 * 24);
  return elapsed >= LUNAR_DAYS;
};
