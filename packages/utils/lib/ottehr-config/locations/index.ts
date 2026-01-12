import _ from 'lodash';
import * as z from 'zod';
import { LOCATIONS_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';

const overrides: any = OVERRIDES || {};
const LOCATION_DEFAULTS: any = {
  inPersonLocations: ['New York', 'Los Angeles'],
  telemedLocations: ['Telemed New Jersey', 'Telemed Ohio'],
};

const mergedLocationConfig = _.merge(
  JSON.parse(JSON.stringify(LOCATION_DEFAULTS)),
  JSON.parse(JSON.stringify(overrides || {}))
);

const LocationConfigSchema = z.object({
  inPersonLocations: z.array(z.string().min(1)),
  telemedLocations: z.array(z.string().min(1)),
});

export const LOCATION_CONFIG = Object.freeze(LocationConfigSchema.parse(mergedLocationConfig));

export const ALL_LOCATIONS = [...LOCATION_CONFIG.inPersonLocations, ...LOCATION_CONFIG.telemedLocations] as const;
