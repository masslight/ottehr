import { createSimpleHash, validateExamConfig } from '../../config-helpers/examination';
import { DefaultExamComponentsConfig, NORMAL_LABELS } from './default-components.config';

export const ExamConfig = {
  default: {
    version: createSimpleHash(JSON.stringify(DefaultExamComponentsConfig)),
    components: DefaultExamComponentsConfig,
    constants: { normalLabels: NORMAL_LABELS },
  },
};

const DefaultExamConfig = Object.freeze(validateExamConfig(ExamConfig));

export const ExamDef = (config?: unknown): ReturnType<typeof validateExamConfig> => {
  if (config) {
    return Object.freeze(validateExamConfig(config));
  }

  return DefaultExamConfig;
};

export const examConfig = ExamDef();
