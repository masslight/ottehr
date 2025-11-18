import { ExamSchema, validateExamConfig } from './examination.schema';
import { InPersonExamConfig } from './in-person.config';
import { TelemedExamConfig } from './telemed.config';

// Simple hash function for versioning (security not required)
function createSimpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export const ExamConfig = {
  telemed: {
    default: {
      version: createSimpleHash(JSON.stringify(TelemedExamConfig)),
      components: TelemedExamConfig,
    },
  },
  inPerson: {
    default: {
      version: createSimpleHash(JSON.stringify(InPersonExamConfig)),
      components: InPersonExamConfig,
    },
  },
};

export enum ExamType {
  TELEMED = 'telemed',
  IN_PERSON = 'inPerson',
}

const DefaultExamConfig = Object.freeze(validateExamConfig(ExamConfig));

export const ExamDef = (config?: unknown): ExamSchema => {
  if (config) {
    return Object.freeze(validateExamConfig(config));
  }

  return DefaultExamConfig;
};
