import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string | undefined): string {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    // Take first letter of last word and first letter of first word
    return (parts[parts.length - 1][0] + parts[0][0]).toUpperCase();
  }
  // Fallback if we don't have two parts
  return name.substring(0, 2).toUpperCase();
}

export function calculateAge(stringBirthDate: string): number {
  const today = new Date();
  const birthDate = new Date(stringBirthDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
