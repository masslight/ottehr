import { z } from 'zod';
import { PROCEDURES_CONFIG_OVERRIDE } from '../../../ottehr-config-overrides/procedures';
import { mergeAndFreezeConfigObjects } from '../helpers';

const DEFAULT_PROCEDURES_CONFIG: ProceduresConfig = {
  prepopulation: {},
};

const mergedConfig = mergeAndFreezeConfigObjects(DEFAULT_PROCEDURES_CONFIG, PROCEDURES_CONFIG_OVERRIDE);

const PrepopulationEntry = z.record(z.union([z.string(), z.array(z.string()), z.boolean()]));

const ProceduresConfigSchema = z.object({
  prepopulation: z.record(PrepopulationEntry),
});

type ProceduresConfig = z.infer<typeof ProceduresConfigSchema>;

export const PROCEDURES_CONFIG = ProceduresConfigSchema.parse(mergedConfig);
