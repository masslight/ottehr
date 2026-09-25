import { CLAIM_ACCIDENT_TYPE } from 'utils/lib/helpers/rcm/constants';

export interface AccidentInfoData {
  accidentType: Array<CLAIM_ACCIDENT_TYPE>;
  accidentState: string;
  accidentDate: string;
}
