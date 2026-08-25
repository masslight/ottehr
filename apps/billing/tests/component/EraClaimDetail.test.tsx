import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EraClaimListItem, EraClaimRemit, EraDetailResponse, getAgeInYears } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EraClaimDetail from '../../src/pages/EraClaimDetail';

const { getBillingEraDetailMock, lookupProcedureDescriptionsMock, oystehrZambdaStub } = vi.hoisted(() => ({
  getBillingEraDetailMock: vi.fn(),
  lookupProcedureDescriptionsMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingEraDetail: getBillingEraDetailMock,
  lookupProcedureDescriptions: lookupProcedureDescriptionsMock,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

const CO_45_DESCRIPTION =
  'Contractual Obligation — Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement.';

const mainRemit: EraClaimRemit = {
  claimResponseId: 'cr-1',
  created: '2026-08-03',
  outcome: 'complete',
  disposition: '',
  eraStatusCode: '1',
  payerClaimControlNumber: 'PC0000123400',
  allowed: 178.43,
  paid: 135.43,
  patientResp: 43,
  patientRespAdjustments: [
    { groupCode: 'PR', reasonCode: '27', amount: 20 },
    { groupCode: 'PR', reasonCode: '3', amount: 23 },
  ],
  serviceLines: [
    {
      itemSequence: 1,
      claimItemSequence: 1,
      isClaimLevel: false,
      cptCode: '10060',
      modifiers: [],
      units: 1,
      serviceDate: '2026-07-25',
      billed: 383,
      allowed: 72.05,
      paid: 72.05,
      deductible: 0,
      coinsurance: 0,
      copay: 0,
      adjustments: [
        {
          groupCode: 'CO',
          reasonCode: '45',
          amount: 310.95,
        },
      ],
    },
    {
      itemSequence: 2,
      claimItemSequence: 2,
      isClaimLevel: false,
      cptCode: '99203',
      modifiers: ['25'],
      units: 1,
      serviceDate: '2026-07-25',
      billed: 339,
      allowed: 63.38,
      paid: 63.38,
      deductible: 0,
      coinsurance: 0,
      copay: 0,
      adjustments: [
        {
          groupCode: 'CO',
          reasonCode: '45',
          amount: 275.62,
        },
      ],
    },
    {
      itemSequence: 3,
      claimItemSequence: 3,
      isClaimLevel: false,
      cptCode: '99213',
      modifiers: [],
      units: 1,
      serviceDate: '2026-07-25',
      billed: 273,
      allowed: 43,
      paid: 0,
      deductible: 0,
      coinsurance: 0,
      copay: 23,
      adjustments: [
        {
          groupCode: 'PR',
          reasonCode: '27',
          amount: 20,
        },
        {
          groupCode: 'PR',
          reasonCode: '3',
          amount: 23,
        },
        {
          groupCode: 'CO',
          reasonCode: '45',
          amount: 230.02,
        },
      ],
    },
  ],
  notes: ['Alert: processed under network agreement'],
};

const matchedClaim: EraClaimListItem = {
  claimId: 'c1',
  patientName: 'Doe, Jane',
  patientDob: '2008-06-07',
  dos: '2026-07-25',
  billed: 995,
  allowed: 178.43,
  paid: 135.43,
  posted: 135.43,
  patientResp: 43,
  patientAccountNumber: 'ACCT-000123456',
  memberId: '999000111',
  status: 'complete',
  matched: true,
  claimResponseIds: ['cr-1'],
  remits: [mainRemit],
};

const unmatchedClaim: EraClaimListItem = {
  claimId: 'unmatched-cr-9',
  patientName: 'Smith, Riley',
  patientDob: '',
  dos: '2026-06-30',
  billed: 80,
  allowed: 0,
  paid: 0,
  posted: 0,
  patientResp: 25,
  patientAccountNumber: 'ACC-7',
  memberId: '',
  status: 'queued',
  matched: false,
  claimResponseIds: ['cr-9'],
  remits: [
    {
      claimResponseId: 'cr-9',
      created: '2026-08-03',
      outcome: 'queued',
      disposition: '',
      eraStatusCode: '4',
      payerClaimControlNumber: '',
      allowed: null,
      paid: 0,
      patientResp: 25,
      patientRespAdjustments: [
        {
          groupCode: 'PR',
          reasonCode: '3',
          amount: 25,
        },
      ],
      serviceLines: [
        {
          itemSequence: null,
          claimItemSequence: null,
          isClaimLevel: true,
          cptCode: '',
          modifiers: [],
          units: null,
          serviceDate: '',
          billed: null,
          allowed: null,
          paid: 0,
          deductible: 0,
          coinsurance: 0,
          copay: 25,
          adjustments: [
            {
              groupCode: 'PR',
              reasonCode: '3',
              amount: 25,
            },
          ],
        },
      ],
      notes: [],
    },
  ],
};

const reversedClaim: EraClaimListItem = {
  ...matchedClaim,
  claimId: 'c2',
  claimResponseIds: ['cr-2', 'cr-2r'],
  remits: [
    { ...mainRemit, claimResponseId: 'cr-2', notes: [] },
    {
      ...mainRemit,
      claimResponseId: 'cr-2r',
      created: '2026-08-04',
      eraStatusCode: '22',
      paid: -135.43,
      notes: [],
    },
  ],
};

const makeEra = (): EraDetailResponse => ({
  id: 'era-1',
  checkNumber: '26TRACE0001234567',
  checkDate: '2026-08-07',
  createdDate: '2026-08-03',
  checkAmount: 135.43,
  payerName: 'Acme Health Plan of Tennessee',
  payerFhirId: 'org-9',
  payee: { name: 'Sunrise Pediatric Urgent Care', npi: '1234567893', taxId: '' },
  status: 'complete',
  paymentMethod: '',
  totalClaims: 3,
  matchedClaims: 2,
  unmatchedClaims: 1,
  x12: 'ISA*00*...~',
  claims: [matchedClaim, reversedClaim, unmatchedClaim],
});

function renderPage(claimId = 'c1'): void {
  render(
    <MemoryRouter initialEntries={[`/eras/era-1/claims/${claimId}`]}>
      <Routes>
        <Route path="/eras/:eraId/claims/:claimId" element={<EraClaimDetail />} />
        <Route path="/eras/:id" element={<div>ERA page</div>} />
        <Route path="/claims/:id" element={<div>Claim page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EraClaimDetail', () => {
  beforeEach(() => {
    getBillingEraDetailMock.mockReset();
    getBillingEraDetailMock.mockResolvedValue(makeEra());
    lookupProcedureDescriptionsMock.mockReset();
    lookupProcedureDescriptionsMock.mockResolvedValue({
      '10060': 'I&D of Abscess',
      '99203': 'Office Visit, New Patient',
      '99213': 'Office Visit, Established Patient',
    });
  });

  it('renders the patient strip with visit date, DOB with age, member id, and account number', async () => {
    renderPage();

    expect(await screen.findByText('Reimbursement Details')).toBeInTheDocument();
    expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
    // the visit date pair plus each service line's date-of-service cell
    expect(screen.getAllByText('07/25/2026')).toHaveLength(4);
    expect(screen.getByText(`06/07/2008 (${getAgeInYears('2008-06-07')}y)`)).toBeInTheDocument();
    expect(screen.getByText('999000111')).toBeInTheDocument();
    expect(screen.getByText('ACCT-000123456')).toBeInTheDocument();
  });

  it('shows the money summary including the derived contractual write-off', async () => {
    renderPage();

    expect(await screen.findByText('Total Claim Billed:')).toBeInTheDocument();
    expect(screen.getByText('$995.00')).toBeInTheDocument();
    expect(screen.getByText('Total Claim Paid:')).toBeInTheDocument();
    expect(screen.getByText('$135.43')).toBeInTheDocument();
    expect(screen.getByText('Total Patient Responsibility:')).toBeInTheDocument();
    // 310.95 + 275.62 + 230.02
    expect(screen.getByText('Contractual Write-Off:')).toBeInTheDocument();
    expect(screen.getByText('$816.59')).toBeInTheDocument();
  });

  it('shows claim and check info with the patient responsibility reason codes', async () => {
    renderPage();

    expect(await screen.findByText('Acme Health Plan of Tennessee')).toBeInTheDocument();
    expect(screen.getByText('PC0000123400')).toBeInTheDocument();
    expect(screen.getByText('26TRACE0001234567')).toBeInTheDocument();
    expect(screen.getByText('08/07/2026')).toBeInTheDocument();
    expect(screen.getAllByText('08/03/2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Sunrise Pediatric Urgent Care (NPI 1234567893)')).toBeInTheDocument();
    expect(
      screen.getByText('PR-27 — Expenses incurred after coverage terminated.; PR-3 — Co-payment amount.')
    ).toBeInTheDocument();
  });

  it('links the claim id to the claim record', async () => {
    const user = userEvent.setup();
    renderPage();

    const link = await screen.findByRole('link', { name: 'c1' });
    await user.click(link);
    expect(await screen.findByText('Claim page')).toBeInTheDocument();
  });

  it('renders service lines with described procedures, amount chips, and adjustment rows', async () => {
    renderPage();

    // descriptions arrive async from the terminology lookup
    expect(await screen.findByText('I&D of Abscess (10060)')).toBeInTheDocument();
    expect(screen.getByText('Office Visit, New Patient (99203:25)')).toBeInTheDocument();
    expect(screen.getByText('Office Visit, Established Patient (99213)')).toBeInTheDocument();

    expect(screen.getByText('$383.00')).toBeInTheDocument();
    expect(screen.getByText('$72.05')).toBeInTheDocument();
    expect(screen.getByText('Paid $72.05')).toBeInTheDocument();
    // line 3 carries the whole patient responsibility: the stat card, its allowed chip, and its
    // patient-resp chip all read $43.00
    expect(screen.getAllByText('$43.00')).toHaveLength(3);
    // lines 1-2 patient-resp chips, plus line 3's zeroed deductible/coinsurance footer values
    expect(screen.getAllByText('$0.00')).toHaveLength(4);

    // adjustment rows: group chip + CARC + explanation + amount
    expect(screen.getAllByText('CO')).toHaveLength(3);
    expect(screen.getAllByText('45')).toHaveLength(3);
    expect(screen.getAllByText(CO_45_DESCRIPTION)).toHaveLength(3);
    expect(screen.getByText('$310.95')).toBeInTheDocument();
    expect(
      screen.getByText('Patient Responsibility — Expenses incurred after coverage terminated.')
    ).toBeInTheDocument();

    // PR bucket footer renders only on the line with PR adjustments; $23.00 is both the PR-3
    // adjustment row amount and the footer's copay value
    expect(screen.getAllByText('Copay:')).toHaveLength(1);
    expect(screen.getAllByText('$23.00')).toHaveLength(2);

    // payer remarks preserved
    expect(screen.getByText('Alert: processed under network agreement')).toBeInTheDocument();

    expect(lookupProcedureDescriptionsMock).toHaveBeenCalledWith(oystehrZambdaStub, ['10060', '99203', '99213']);
  });

  it('falls back to the bare code when the terminology service has no description', async () => {
    lookupProcedureDescriptionsMock.mockResolvedValue({});
    renderPage();

    expect(await screen.findByText('10060')).toBeInTheDocument();
    expect(screen.getByText('99203:25')).toBeInTheDocument();
  });

  it('collapses a line’s adjustments with the chevron', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('I&D of Abscess (10060)')).toBeInTheDocument();
    expect(screen.getAllByText(CO_45_DESCRIPTION)).toHaveLength(3);

    await user.click(screen.getAllByRole('button', { name: 'Toggle adjustments' })[0]);
    expect(screen.getAllByText(CO_45_DESCRIPTION)).toHaveLength(2);
  });

  it('renders the unmatched claim variant with a chip and claim-level adjustment row', async () => {
    renderPage('unmatched-cr-9');

    expect(await screen.findByText('Smith, Riley')).toBeInTheDocument();
    expect(screen.getByText('Unmatched')).toBeInTheDocument();
    expect(screen.getByText('Claim-level adjustments')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders one section per remit with status headers for reversals', async () => {
    renderPage('c2');

    expect(await screen.findByText('Reversal')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getAllByText('Service Line Details & Adjustments')).toHaveLength(2);
  });

  it('closes back to the ERA detail page', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Reimbursement Details')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('ERA page')).toBeInTheDocument();
  });

  it('shows an error state when the claim is not on the ERA', async () => {
    renderPage('nope');

    expect(await screen.findByText('Claim not found on this ERA')).toBeInTheDocument();
  });
});
