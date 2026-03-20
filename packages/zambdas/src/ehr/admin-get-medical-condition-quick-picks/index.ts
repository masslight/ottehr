import { MEDICAL_CONDITION_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler('admin-get-medical-condition-quick-picks', MEDICAL_CONDITION_QUICK_PICK_CATEGORY);
