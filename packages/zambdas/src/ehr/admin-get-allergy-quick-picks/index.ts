import { ALLERGY_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler('admin-get-allergy-quick-picks', ALLERGY_QUICK_PICK_CATEGORY);
