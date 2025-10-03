import { VitalsObservationDTO } from 'utils';

export type UseSaveVitals = (props: { encounterId: string }) => (vitalEntity: VitalsObservationDTO) => Promise<void>;
export type UseDeleteVitals = (props: { encounterId: string }) => (vitalEntity: VitalsObservationDTO) => Promise<void>;

export interface VitalsCardProps<TypeObsDTO extends VitalsObservationDTO> {
  handleSaveVital: (vitalEntity: VitalsObservationDTO) => Promise<void>;
  handleDeleteVital: (vitalEntity: VitalsObservationDTO) => Promise<void>;
  currentObs: TypeObsDTO[];
  historicalObs: TypeObsDTO[];
  historyElementSkeletonText?: string;
}

export const HISTORY_ELEMENT_SKELETON_TEXT = 'x'.repeat(55);
