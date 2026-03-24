import { createSimpleHash, validateExamConfig } from '../../config-helpers/examination';
import { InPersonExamConfig } from './in-person.config';
import { TelemedExamConfig } from './telemed.config';

// Re-export helpers for backward compatibility
export {
  createSimpleHash,
  validateExamConfig,
  isDropdownComponent,
  isMultiSelectComponent,
} from '../../config-helpers/examination';
export type { ExamSchema } from '../../config-helpers/examination';

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

export const ExamDef = (config?: unknown): ReturnType<typeof validateExamConfig> => {
  if (config) {
    return Object.freeze(validateExamConfig(config));
  }

  return DefaultExamConfig;
};

export const examConfig = ExamDef();
