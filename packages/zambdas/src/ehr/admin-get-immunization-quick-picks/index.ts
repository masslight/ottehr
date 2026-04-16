import { IMMUNIZATION_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler('admin-get-immunization-quick-picks', IMMUNIZATION_QUICK_PICK_CATEGORY);
