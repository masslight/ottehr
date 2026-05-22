import { InsuranceQuickPickData, INVALID_INPUT_ERROR } from 'utils';
import { INSURANCE_QUICK_PICK_CATEGORY } from '../shared/quick-pick-categories';
import { searchQuickPicks } from '../shared/quick-pick-helpers';
import { makeUpdateHandler } from '../shared/quick-pick-zambda';

export const index = makeUpdateHandler(
  'admin-update-insurance-quick-pick',
  INSURANCE_QUICK_PICK_CATEGORY,
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
    if (!quickPick.payerId || typeof quickPick.payerId !== 'string') {
      throw INVALID_INPUT_ERROR('quickPick.payerId is required and must be a string');
    }
    if (!quickPick.organizationReference || typeof quickPick.organizationReference !== 'string') {
      throw INVALID_INPUT_ERROR('quickPick.organizationReference is required and must be a string');
    }
    return { quickPickId, quickPick: quickPick as Omit<InsuranceQuickPickData, 'id'> };
  },
  async (oystehr, quickPickId, quickPick) => {
    const existing = await searchQuickPicks(oystehr, INSURANCE_QUICK_PICK_CATEGORY);
    if (existing.some((p) => p.id !== quickPickId && p.organizationReference === quickPick.organizationReference)) {
      throw INVALID_INPUT_ERROR(`An insurance quick pick for ${quickPick.name} already exists`);
    }
  }
);
