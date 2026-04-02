import { MEDICATION_HISTORY_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler('admin-get-medication-history-quick-picks', MEDICATION_HISTORY_QUICK_PICK_CATEGORY);
