import { ProceduresConfig, ProceduresConfigSchema } from 'ottehr-types';
import { PROCEDURES_CONFIG_OVERRIDE } from '../../../ottehr-config-overrides/procedures';
import { mergeAndFreezeConfigObjects } from '../helpers';

const DEFAULT_PROCEDURES_CONFIG: ProceduresConfig = {
  prepopulation: {},
  favorites: [],
};

const mergedConfig = mergeAndFreezeConfigObjects(DEFAULT_PROCEDURES_CONFIG, PROCEDURES_CONFIG_OVERRIDE);

export const PROCEDURES_CONFIG = ProceduresConfigSchema.parse(mergedConfig);
