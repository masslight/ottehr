import { createSimpleHash, validateExamConfig } from '../../config-helpers/examination';
import {
  CONFIG_INJECTION_KEYS,
  createProxyConfigObject,
  mergeAndFreezeConfigObjects,
} from '../../config-helpers/helpers';
import { InPersonExamConfig } from './in-person.config';
import { TelemedExamConfig } from './telemed.config';

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

export type ExamConfigType = ReturnType<typeof validateExamConfig>;

export const ExamDef = (config?: unknown): ExamConfigType => {
  if (config) {
    return Object.freeze(validateExamConfig(config));
  }

  return DefaultExamConfig;
};

function getExamConfig(testOverrides?: Partial<ExamConfigType>): ExamConfigType {
  if (!testOverrides) {
    return DefaultExamConfig;
  }
  return mergeAndFreezeConfigObjects(DefaultExamConfig, testOverrides) as ExamConfigType;
}

export const examConfig = createProxyConfigObject<ExamConfigType>(getExamConfig, CONFIG_INJECTION_KEYS.EXAMINATION);
