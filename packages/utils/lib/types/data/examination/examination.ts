import { z } from 'zod';
import { ExamConfigType } from './exam-config.types';
import { ExamConfigTypeSchema, validateExamConfig } from './examination.schema';
import { InPersonExamConfig } from './in-person.config';
import { TelemedExamConfig } from './telemed.config';

const ExamConfig: ExamConfigType = {
  telemed: {
    default: {
      components: TelemedExamConfig,
    },
  },
  inPerson: {
    default: {
      components: InPersonExamConfig,
    },
  },
};

export const DefaultExamConfig = Object.freeze(validateExamConfig(ExamConfig));

export type ExamSchema = z.infer<typeof ExamConfigTypeSchema>;

export const ExamDef = (config?: unknown): ExamSchema => {
  if (config) {
    return Object.freeze(validateExamConfig(config));
  }

  return DefaultExamConfig;
};
