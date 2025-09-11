import { customScreeningQuestionsConfig } from '../../../.ottehr_config/screening-questions';
import { baseScreeningQuestionsConfig } from '../../types/data/screening-questions/config';

// TODO: Consider exporting types/helpers/constants based on config, but this seems unnecessary.
// Current approach: make customer code use our common logic and only override specific config values.
export * from '../../types/data/screening-questions/config';

// export actual config
export const patientScreeningQuestionsConfig = customScreeningQuestionsConfig || baseScreeningQuestionsConfig;
