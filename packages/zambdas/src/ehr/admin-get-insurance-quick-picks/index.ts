import { INSURANCE_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler('admin-get-insurance-quick-picks', INSURANCE_QUICK_PICK_CATEGORY);
