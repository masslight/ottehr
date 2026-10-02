import { describe, expect, it } from 'vitest';
import {
  applyProcedureQuickPick,
  buildProcedureQuickPick,
} from '../../src/features/visits/in-person/pages/procedureQuickPick';

describe('procedure quick picks', () => {
  it('saves and applies "performed by" along with "documented by"', () => {
    const source = { performerType: 'Both', documentedBy: 'Provider' } as Parameters<typeof buildProcedureQuickPick>[0];
    const saved = buildProcedureQuickPick(source, 'EKG – normal', 'EKG', [{ name: 'EKG', code: 'ekg' }]);
    expect(saved).toMatchObject({ performerType: 'Both', documentedBy: 'Provider' });

    const target = {} as Parameters<typeof applyProcedureQuickPick>[0];
    applyProcedureQuickPick(target, { id: 'qp-1', ...saved }, 'EKG');
    expect(target).toMatchObject({ performerType: 'Both', documentedBy: 'Provider' });
  });
});
