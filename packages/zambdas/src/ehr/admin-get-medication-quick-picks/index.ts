import { MEDICATION_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler('admin-get-medication-quick-picks', MEDICATION_QUICK_PICK_CATEGORY);
