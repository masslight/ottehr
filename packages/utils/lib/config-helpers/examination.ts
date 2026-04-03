export { validateExaminationConfig as validateExamConfig } from 'config-types';
export type { ExaminationConfig as ExamSchema } from 'config-types';

// Re-export type guards from examination.schema
export { isDropdownComponent, isMultiSelectComponent } from '../ottehr-config/examination/examination.schema';

// Simple hash function for versioning (security not required)
export function createSimpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
