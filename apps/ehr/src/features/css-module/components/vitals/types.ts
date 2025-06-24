import { VitalsObservationDTO, VitalsSearchConfig } from 'utils';

export type UseVitalsHandlers = (props: { encounterId: string; searchConfig: VitalsSearchConfig }) => {
  vitalsEntities: VitalsObservationDTO[];
  isLoading: boolean;
  handleSave: ReturnType<UseSaveVitals>;
  handleDelete: ReturnType<UseDeleteVitals>;
};

export type UseSaveVitals = (props: {
  encounterId: string;
  searchConfig: VitalsSearchConfig;
}) => (vitalEntity: VitalsObservationDTO) => Promise<void>;

export type UseDeleteVitals = (props: {
  encounterId: string;
  searchConfig: VitalsSearchConfig;
}) => (vitalEntity: VitalsObservationDTO) => Promise<void>;

export type VitalHistoryEntry<T extends VitalsObservationDTO> = {
  vitalObservationDTO: T;
  fhirResourceId?: string;
  recordDateTime?: string;
  author?: string;
  isDeletable: boolean;
  debugEntrySource?: 'patient' | 'encounter';
};
