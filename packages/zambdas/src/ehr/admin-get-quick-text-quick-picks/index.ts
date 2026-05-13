import { QUICK_TEXT_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeGetHandler } from '../shared/quick-pick-zambda';

export const index = makeGetHandler('admin-get-quick-text-quick-picks', QUICK_TEXT_QUICK_PICK_CATEGORY);
