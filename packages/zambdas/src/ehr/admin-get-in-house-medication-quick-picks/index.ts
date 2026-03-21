import { IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler(
  'admin-get-in-house-medication-quick-picks',
  IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY
);
