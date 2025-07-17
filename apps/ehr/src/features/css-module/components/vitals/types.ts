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

export interface VitalsCardProps<TypeObsDTO extends VitalsObservationDTO> {
  handleSaveVital: (vitalEntity: VitalsObservationDTO) => Promise<void>;
  handleDeleteVital: (vitalEntity: VitalsObservationDTO) => Promise<void>;
  isLoading: boolean;
  currentObs: TypeObsDTO[];
  historicalObs: TypeObsDTO[];
  historyElementSkeletonText: string;
}
