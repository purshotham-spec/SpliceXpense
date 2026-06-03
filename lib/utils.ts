import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AED: 'د.إ',
  SGD: 'S$',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  THB: '฿',
  MYR: 'RM',
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function fmt(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${Number(amount).toFixed(2)}`;
}
