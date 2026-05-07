import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind class isimlerini birleştirir ve çakışan sınıfları temizler.
 * Örnek: cn('p-4', condition && 'p-2') → koşullu olarak 'p-2' kazanır.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
