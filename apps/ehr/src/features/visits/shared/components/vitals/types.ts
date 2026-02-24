import { VitalsObservationDTO } from 'utils';
import { VitalField } from './hooks/useVitalsManagement';

export interface VitalsCardProps<TypeObsDTO extends VitalsObservationDTO> {
  field: VitalField<TypeObsDTO>;
  historyElementSkeletonText?: string;
}
