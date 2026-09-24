import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pendingSupervisorApproval = vi.fn().mockResolvedValue(undefined);
let oystehrZambda: object | undefined = {};

vi.mock('src/api/api', () => ({
  pendingSupervisorApproval: (...args: unknown[]) => pendingSupervisorApproval(...args),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda }),
}));

import { usePendingSupervisorApproval } from '../../src/features/visits/telemed/hooks/usePendingSupervisorApproval';

const renderUpdater = (overrides: { encounterId?: string; practitionerId?: string } = {}): (() => Promise<void>) =>
  renderHook(() =>
    usePendingSupervisorApproval({
      encounterId: overrides.encounterId ?? 'encounter-1',
      practitionerId: overrides.practitionerId ?? 'practitioner-1',
    })
  ).result.current.updateVisitStatusToAwaitSupervisorApproval;

describe('usePendingSupervisorApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oystehrZambda = {};
  });

  it('routes the encounter for approval', async () => {
    await expect(renderUpdater()()).resolves.toBeUndefined();

    expect(pendingSupervisorApproval).toHaveBeenCalledWith(
      {},
      { encounterId: 'encounter-1', practitionerId: 'practitioner-1' }
    );
  });

  it('rejects when the request fails', async () => {
    pendingSupervisorApproval.mockRejectedValueOnce(new Error('zambda exploded'));

    await expect(renderUpdater()()).rejects.toThrow('zambda exploded');
  });

  it('rejects rather than no-opping when a prerequisite is missing', async () => {
    await expect(renderUpdater({ encounterId: '' })()).rejects.toThrow(/Encounter ID is required/);
    await expect(renderUpdater({ practitionerId: '' })()).rejects.toThrow(/Practitioner ID is required/);

    oystehrZambda = undefined;
    await expect(renderUpdater()()).rejects.toThrow(/Oystehr Zambda client is not available/);

    expect(pendingSupervisorApproval).not.toHaveBeenCalled();
  });
});
