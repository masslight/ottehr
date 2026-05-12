import { PATIENT_INSTRUCTION_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler(
  'admin-get-patient-instruction-quick-picks',
  PATIENT_INSTRUCTION_QUICK_PICK_CATEGORY
);
