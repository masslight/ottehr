import { ExamSchema, validateExamConfig } from './examination.schema';
import { InPersonExamConfig } from './in-person.config';
import { TelemedExamConfig } from './telemed.config';

const ExamConfig = {
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

const DefaultExamConfig = Object.freeze(validateExamConfig(ExamConfig));

export const ExamDef = (config?: unknown): ExamSchema => {
  if (config) {
    return Object.freeze(validateExamConfig(config));
  }

  return DefaultExamConfig;
};
