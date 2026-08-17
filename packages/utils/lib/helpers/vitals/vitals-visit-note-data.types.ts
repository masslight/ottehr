import { VitalFieldNames } from '../../types/api/chart-data/chart-data.constants';

export type VitalsVisitNoteData = {
  [K in VitalFieldNames]?: string[];
};
