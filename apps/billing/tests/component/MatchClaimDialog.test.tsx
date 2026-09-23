import { render, screen, within } from '@testing-library/react';
import { EraClaimListItem } from 'utils/lib/types/data/billing/billing.types';
import { describe, expect, it, vi } from 'vitest';
import { MatchClaimDialog } from '../../src/components/MatchClaimDialog';

const { oystehrZambdaStub } = vi.hoisted(() => ({
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  matchClaimResponseToClaim: vi.fn(),
  searchBillingClaims: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

const unmatchedEraClaim: EraClaimListItem = {
  claimId: 'unmatched-cr-2',
  patientName: 'Smith, Riley',
  patientDob: '',
  dos: '2026-06-30',
  billed: 80,
  allowed: 0,
  paid: 0,
  posted: 0,
  patientResp: 25,
  patientAccountNumber: 'ACC-7',
  memberId: 'MBR-777',
  status: 'queued',
  matched: false,
  claimResponseIds: ['cr-2'],
  remits: [],
};

function renderDialog(patientDob: string): void {
  render(
    <MatchClaimDialog
      claimResponseId="cr-2"
      eraClaim={{
        ...unmatchedEraClaim,
        patientDob,
      }}
      onClose={vi.fn()}
      onMatched={vi.fn()}
    />
  );
}

describe('MatchClaimDialog', () => {
  it('labels the ERA patient DOB as missing when the remit carries none', () => {
    renderDialog('');

    const dobBlock = screen.getByText('Patient DOB').parentElement!;
    expect(within(dobBlock).getByText('Not in ERA')).toBeInTheDocument();
  });

  it('shows the ERA patient DOB when the remit carries one', () => {
    renderDialog('2008-06-07');

    const dobBlock = screen.getByText('Patient DOB').parentElement!;
    expect(within(dobBlock).getByText('2008-06-07')).toBeInTheDocument();
    expect(within(dobBlock).queryByText('Not in ERA')).not.toBeInTheDocument();
  });
});
