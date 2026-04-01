import { INVALID_INPUT_ERROR } from 'utils';
import { MEDICATION_HISTORY_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { makeUpdateHandler } from '../shared/quick-pick-zambda';

export const index = makeUpdateHandler(
  'admin-update-medication-history-quick-pick',
  MEDICATION_HISTORY_QUICK_PICK_CATEGORY,
  (body) => {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const quickPickId = parsed.quickPickId;
    if (typeof quickPickId !== 'string') {
      throw INVALID_INPUT_ERROR('quickPickId must be a string');
    }
    const quickPick = parsed.quickPick as Record<string, unknown> | undefined;
    if (!quickPick || typeof quickPick !== 'object') {
      throw INVALID_INPUT_ERROR('quickPick must be an object');
    }
    if (!quickPick.name || typeof quickPick.name !== 'string') {
      throw INVALID_INPUT_ERROR('quickPick.name is required and must be a string');
    }
    return { quickPickId, quickPick: quickPick as any };
  }
);
