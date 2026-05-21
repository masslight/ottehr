import { INSURANCE_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeRemoveHandler } from '../shared/quick-pick-zambda';

export const index = makeRemoveHandler('admin-remove-insurance-quick-pick', INSURANCE_QUICK_PICK_CATEGORY);
