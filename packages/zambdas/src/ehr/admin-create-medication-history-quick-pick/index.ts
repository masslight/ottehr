import { INVALID_INPUT_ERROR } from 'utils';
import { MEDICATION_HISTORY_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeCreateHandler } from '../shared/quick-pick-zambda';

export const index = makeCreateHandler(
  'admin-create-medication-history-quick-pick',
  MEDICATION_HISTORY_QUICK_PICK_CATEGORY,
  (body) => {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const quickPick = parsed.quickPick as Record<string, unknown> | undefined;
    if (!quickPick || typeof quickPick !== 'object') {
      throw INVALID_INPUT_ERROR('quickPick must be an object');
    }
    if (!quickPick.name || typeof quickPick.name !== 'string') {
      throw INVALID_INPUT_ERROR('quickPick.name is required and must be a string');
    }
    return { quickPick: quickPick as any };
  }
);
