import { VitalFieldNames } from '../../types';

export type VitalsVisitNoteData = {
  [K in VitalFieldNames]?: string[];
};
