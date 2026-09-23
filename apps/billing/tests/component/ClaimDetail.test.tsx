import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  ClaimDetailResponse,
  ClaimInsurancePayment,
  ClaimRemit,
  EraRemitServiceLine,
} from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, emptyClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROVISIONAL_BALANCE_HINT } from '../../src/constants/claimStatus';
import ClaimDetail from '../../src/pages/ClaimDetail';

const {
  getBillingClaimDetailMock,
  runBillingRulesEngineMock,
  getBillingClaimHistoryMock,
  addBillingClaimNoteMock,
  oystehrZambdaStub,
} = vi.hoisted(() => ({
  getBillingClaimDetailMock: vi.fn(),
  runBillingRulesEngineMock: vi.fn(),
  getBillingClaimHistoryMock: vi.fn(),
  addBillingClaimNoteMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingClaimDetail: getBillingClaimDetailMock,
  runBillingRulesEngine: runBillingRulesEngineMock,
  getBillingClaimHistory: getBillingClaimHistoryMock,
  addBillingClaimNote: addBillingClaimNoteMock,
  getPatientCoverages: vi.fn(),
  searchBillingLocations: vi.fn(),
  searchBillingPayers: vi.fn(),
  searchBillingProviders: vi.fn(),
  searchBillingTags: vi.fn().mockResolvedValue({ tags: [] }),
  tagBillingClaim: vi.fn(),
  updateBillingResource: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

const { enqueueSnackbarMock } = vi.hoisted(() => ({ enqueueSnackbarMock: vi.fn() }));

vi.mock('notistack', () => ({
  enqueueSnackbar: enqueueSnackbarMock,
  SnackbarProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));

const emptyAddressParts = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
};

const makeClaim = (arStage: string): ClaimDetailResponse => ({
  id: 'claim-1',
  encounterId: '',
  appointmentId: '',
  type: 'professional',
  status: '',
  statuses: {
    ...emptyClaimStatusValues(),
    arStage,
  },
  created: '2026-01-01',
  patientName: 'Jane Doe',
  patientDob: '1990-01-01',
  patientGender: 'female',
  patientId: 'patient-1',
  patientOriginalId: 'patient-orig-1',
  patientAddress: '',
  patientAddressParts: emptyAddressParts,
  coverageFhirId: '',
  payorFhirId: '',
  payerName: '',
  payerId: '',
  memberId: '',
  subscriberId: '',
  planType: '',
  relationship: 'Self',
  policyHolder: null,
  responsibleParty: '',
  secondaryCoverageFhirId: '',
  secondaryPayerName: '',
  secondaryPayerId: '',
  secondaryMemberId: '',
  tertiaryCoverageFhirId: '',
  tertiaryPayerName: '',
  tertiaryPayerId: '',
  tertiaryMemberId: '',
  quaternaryCoverageFhirId: '',
  quaternaryPayerName: '',
  quaternaryPayerId: '',
  quaternaryMemberId: '',
  nonInsurancePayerFhirId: '',
  nonInsurancePayerName: '',
  renderingProviderId: '',
  renderingProviderType: '',
  renderingProvider: '',
  renderingNpi: '',
  renderingTaxonomy: '',
  billingProviderFhirId: '',
  billingProviderType: '',
  billingProvider: '',
  billingNpi: '',
  billingTin: '',
  billingTaxonomy: '',
  facilityFhirId: '',
  serviceFacility: '',
  serviceFacilityId: '',
  serviceFacilityAddress: '',
  serviceFacilityAddressParts: emptyAddressParts,
  serviceFacilityNpi: '',
  diagnoses: [],
  serviceLines: [],
  billed: 0,
  allowed: 0,
  insurancePaid: 0,
  patientResp: 0,
  patientPaid: 0,
  balance: 0,
  adjudicated: false,
  firstSubmittedDate: '',
  remits: [],
  insurancePayments: [],
  patientPayments: [],
  otherClaims: [],
  tags: [],
  pcn: '',
  billType: '',
  patientDischargeStatusCode: '',
  admissionType: '',
  admissionSource: '',
  admissionDate: '',
  dischargeDate: '',
  attachments: [],
});

const makeRemit = (overrides: Partial<ClaimRemit>): ClaimRemit => ({
  claimResponseId: 'cr-1',
  date: '2026-07-08T18:20:39.029Z',
  payerName: 'Test Payer',
  status: 'complete',
  eraStatusCode: '1',
  allowed: 80,
  paid: 60,
  patientResp: 20,
  adjustments: [],
  paymentReconciliationId: '',
  checkNumber: '',
  checkDate: '',
  serviceLines: [],
  ...overrides,
});

const makeRemitLine = (overrides: Partial<EraRemitServiceLine>): EraRemitServiceLine => ({
  itemSequence: 1,
  claimItemSequence: 1,
  isClaimLevel: false,
  cptCode: '',
  modifiers: [],
  units: 1,
  serviceDate: '2026-08-14',
  billed: null,
  allowed: null,
  paid: 0,
  deductible: 0,
  coinsurance: 0,
  copay: 0,
  adjustments: [],
  ...overrides,
});

const makePayment = (overrides: Partial<ClaimInsurancePayment>): ClaimInsurancePayment => ({
  paymentReconciliationId: 'pr-1',
  checkNumber: 'ERA0000000001',
  remitDate: '2026-07-07T10:00:00Z',
  checkDate: '2026-07-08',
  paymentAmount: 350,
  payerName: 'CIGNA',
  status: 'active',
  ...overrides,
});

const cellTexts = (row: HTMLElement | null): (string | null)[] => {
  expect(row).not.toBeNull();
  return within(row as HTMLElement)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
};

function renderDetail(): void {
  render(
    <MemoryRouter initialEntries={['/claims/claim-1']}>
      <Routes>
        <Route path="/claims/:id" element={<ClaimDetail />} />
        <Route path="/eras/:id" element={<div>ERA page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClaimDetail — remits', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('renders remit rows with payment details and adjustment codes', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      remits: [
        makeRemit({
          adjustments: [
            {
              groupCode: 'PR',
              reasonCode: '1',
              amount: 15,
            },
            {
              groupCode: 'CO',
              reasonCode: '45',
              amount: 20,
            },
          ],
          paymentReconciliationId: 'pr-1',
          checkNumber: 'CHK-1',
          checkDate: '2026-07-10',
        }),
      ],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    const remits = await screen.findByRole('table', { name: 'Remits' });
    expect(cellTexts(within(remits).getByText('Test Payer').closest('tr'))).toEqual([
      '07/08/2026',
      '07/10/2026',
      'Test PayerPrimary',
      'CHK-1',
      'PR-1 $15.00CO-45 $20.00',
      '$80.00',
      '$60.00',
      '$20.00',
    ]);
  });

  it('renders each amount by state: missing as a dash, zero as $0.00, positive as currency', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      remits: [
        makeRemit({
          claimResponseId: 'cr-2',
          date: '2026-07-09T10:00:00.000Z',
          payerName: 'Aetna',
          eraStatusCode: '',
          allowed: null,
          paid: 0,
          patientResp: 20,
        }),
      ],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    expect(cellTexts((await screen.findByText('Aetna')).closest('tr'))).toEqual([
      '07/09/2026',
      '-',
      'Aetna',
      '-',
      '-',
      '-',
      '$0.00',
      '$20.00',
    ]);
  });

  it('opens the ERA behind a remit in a new tab, and leaves a remit with no known ERA inert', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      remits: [
        makeRemit({ claimResponseId: 'cr-linked', payerName: 'Linked Payer', paymentReconciliationId: 'pr-1' }),
        makeRemit({ claimResponseId: 'cr-unlinked', payerName: 'Unlinked Payer' }),
      ],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    fireEvent.click((await screen.findByText('Unlinked Payer')).closest('tr') as HTMLElement);
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Linked Payer').closest('tr') as HTMLElement);
    expect(openSpy).toHaveBeenCalledWith('/eras/pr-1', '_blank', 'noopener');
    openSpy.mockRestore();
  });

  it('opens the ERA behind a focused remit row from Enter or Space', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      remits: [
        makeRemit({
          claimResponseId: 'cr-linked',
          payerName: 'Linked Payer',
          paymentReconciliationId: 'pr-1',
          checkNumber: 'CHK1',
        }),
        makeRemit({ claimResponseId: 'cr-unlinked', payerName: 'Unlinked Payer' }),
      ],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    expect((await screen.findByText('Unlinked Payer')).closest('tr')).not.toHaveAttribute('tabindex');
    const row = screen.getByText('Linked Payer').closest('tr') as HTMLElement;
    expect(row).toHaveAttribute('tabindex', '0');

    act(() => row.focus());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenLastCalledWith('/eras/pr-1', '_blank', 'noopener');

    // the check link opens the ERA itself; its keys do not reach the row
    fireEvent.keyDown(within(row).getByRole('link', { name: 'CHK1' }), { key: 'Enter' });
    expect(openSpy).toHaveBeenCalledTimes(2);
    openSpy.mockRestore();
  });

  it('shows the empty state when the claim has no remits', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    expect(await screen.findByText('No remits yet')).toBeInTheDocument();
  });
});

describe('ClaimDetail — insurance payments', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('lists insurance payments and opens the ERA in a new tab on row click or Enter', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      insurancePayments: [makePayment({})],
    });
    renderDetail();

    const remitsTab = await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' });
    fireEvent.click(remitsTab);

    const checkLink = await screen.findByRole('link', { name: 'ERA0000000001' });
    expect(checkLink).toHaveAttribute('href', '/eras/pr-1');
    expect(checkLink).toHaveAttribute('target', '_blank');

    const row = checkLink.closest('tr');
    expect(cellTexts(row)).toEqual(['07/07/2026', '07/08/2026', 'CIGNA', 'ERA0000000001', '$350.00']);

    fireEvent.click(row as HTMLElement);
    expect(openSpy).toHaveBeenCalledWith('/eras/pr-1', '_blank', 'noopener');
    expect(screen.queryByText('ERA page')).not.toBeInTheDocument();

    act(() => row?.focus());
    await user.keyboard('{Enter}');
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenLastCalledWith('/eras/pr-1', '_blank', 'noopener');
    openSpy.mockRestore();
  });
});

describe('ClaimDetail — service line remit details', () => {
  const serviceLines: ClaimDetailResponse['serviceLines'] = [
    {
      sequence: 1,
      cptCode: 'A7020',
      description: '',
      modifiers: [],
      units: 1,
      charges: 201.04,
      serviceDate: '2026-08-14',
      placeOfService: '',
      diagnosisPointers: [],
      revenueCode: '',
    },
    {
      sequence: 2,
      cptCode: '99203',
      description: '',
      modifiers: [],
      units: 1,
      charges: 20,
      serviceDate: '2026-08-14',
      placeOfService: '',
      diagnosisPointers: [],
      revenueCode: '',
    },
  ];

  const remit = makeRemit({
    claimResponseId: 'cr-1',
    date: '2026-08-18T10:00:00Z',
    payerName: 'Employers Mutual',
    eraStatusCode: '1',
    allowed: 176.83,
    paid: 136.83,
    patientResp: 40,
    adjustments: [
      { groupCode: 'CO', reasonCode: '45', amount: 40.21 },
      { groupCode: 'PR', reasonCode: '3', amount: 25 },
      { groupCode: 'CO', reasonCode: '45', amount: 4 },
      { groupCode: 'PR', reasonCode: '1', amount: 15 },
    ],
    paymentReconciliationId: 'pr-1',
    checkNumber: 'CHK00012347',
    checkDate: '2026-08-22',
    serviceLines: [
      makeRemitLine({
        claimItemSequence: 1,
        cptCode: 'A7020',
        billed: 201.04,
        allowed: 160.83,
        paid: 135.83,
        copay: 25,
        adjustments: [
          { groupCode: 'CO', reasonCode: '45', amount: 40.21 },
          { groupCode: 'PR', reasonCode: '3', amount: 25 },
        ],
      }),
      makeRemitLine({
        itemSequence: 2,
        claimItemSequence: 2,
        cptCode: '99203',
        billed: 20,
        allowed: 16,
        paid: 1,
        deductible: 15,
        adjustments: [
          { groupCode: 'CO', reasonCode: '45', amount: 4 },
          { groupCode: 'PR', reasonCode: '1', amount: 15 },
        ],
      }),
    ],
  });

  const claimWithRemits = (overrides: Partial<ClaimDetailResponse> = {}): ClaimDetailResponse => ({
    ...makeClaim(AR_STAGE.patient),
    created: '2026-08-14',
    firstSubmittedDate: '2026-08-15T12:00:00Z',
    serviceLines,
    billed: 221.04,
    allowed: 176.83,
    insurancePaid: 136.83,
    patientResp: 40,
    patientPaid: 60,
    balance: -20,
    adjudicated: true,
    remits: [remit],
    insurancePayments: [
      makePayment({
        paymentReconciliationId: 'pr-1',
        checkNumber: 'CHK00012347',
        remitDate: '2026-08-18T09:00:00Z',
        checkDate: '2026-08-22',
        paymentAmount: 500,
        payerName: 'Employers Mutual',
      }),
      makePayment({
        paymentReconciliationId: 'pr-2',
        checkNumber: 'CHK00012345',
        payerName: 'Employers Mutual',
      }),
    ],
    ...overrides,
  });

  const openRemitsTab = async (): Promise<void> => {
    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));
  };

  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it("lists each line's charge, then the payer's response and its adjustments in their columns", async () => {
    getBillingClaimDetailMock.mockResolvedValue(claimWithRemits());
    renderDetail();
    await openRemitsTab();

    const line1 = await screen.findByRole('table', { name: 'Remit details for line 1' });
    expect(
      within(line1)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
    ).toEqual(['Date', 'Type', 'Billed', 'Allowed', 'Ins adj', 'Ins paid', 'Deductible', 'Co-ins', 'Copay', 'Patient']);
    expect(cellTexts(within(line1).getByText('Charge').closest('tr'))).toEqual(['08/15/2026', 'Charge', '$201.04', '']);
    // Patient is the line's patient responsibility: here all of it is the copay
    const payerRow = within(line1).getByText('Employers Mutual').closest('tr') as HTMLElement;
    expect(cellTexts(payerRow)).toEqual([
      '08/18/2026',
      'Employers Mutual',
      '$201.04',
      '$160.83',
      '$40.21',
      '$135.83',
      '$0.00',
      '$0.00',
      '$25.00',
      '$25.00',
    ]);
    // what the patient owes is boxed in orange like the allowed and paid amounts; nothing owed stays plain
    expect(Array.from(payerRow.querySelectorAll('.MuiChip-colorWarning'), (chip) => chip.textContent)).toEqual([
      '$25.00',
      '$25.00',
    ]);
    expect(cellTexts(within(line1).getByText('CO-45').closest('tr'))).toEqual([
      '08/18/2026',
      'CO-45',
      '',
      '',
      '$40.21',
      '',
      '',
      '',
      '',
      '',
    ]);
    expect(cellTexts(within(line1).getByText('PR-3').closest('tr'))).toEqual([
      '08/18/2026',
      'PR-3',
      '',
      '',
      '',
      '',
      '',
      '',
      '$25.00',
      '',
    ]);

    const line2 = screen.getByRole('table', { name: 'Remit details for line 2' });
    expect(cellTexts(within(line2).getByText('PR-1').closest('tr'))).toEqual([
      '08/18/2026',
      'PR-1',
      '',
      '',
      '',
      '',
      '$15.00',
      '',
      '',
      '',
    ]);
  });

  it("shows the line's whole patient responsibility under Patient, and PR outside the buckets there too", async () => {
    getBillingClaimDetailMock.mockResolvedValue(
      claimWithRemits({
        remits: [
          {
            ...remit,
            serviceLines: [
              makeRemitLine({
                claimItemSequence: 1,
                cptCode: 'A7020',
                billed: 201.04,
                allowed: 100,
                paid: 83,
                deductible: 10,
                adjustments: [
                  { groupCode: 'CO', reasonCode: '45', amount: 5 },
                  { groupCode: 'PR', reasonCode: '1', amount: 10 },
                  { groupCode: 'PR', reasonCode: '96', amount: 7 },
                ],
              }),
            ],
          },
        ],
      })
    );
    renderDetail();
    await openRemitsTab();

    const line1 = await screen.findByRole('table', { name: 'Remit details for line 1' });
    const cells = cellTexts(within(line1).getByText('Employers Mutual').closest('tr'));
    expect(cells.slice(6)).toEqual(['$10.00', '$0.00', '$0.00', '$17.00']);
    expect(cellTexts(within(line1).getByText('PR-1').closest('tr')).slice(6)).toEqual(['$10.00', '', '', '']);
    expect(cellTexts(within(line1).getByText('PR-96').closest('tr')).slice(6)).toEqual(['', '', '', '$7.00']);
  });

  it('dates the charge by when the claim was created when it was never submitted', async () => {
    getBillingClaimDetailMock.mockResolvedValue(claimWithRemits({ firstSubmittedDate: '' }));
    renderDetail();
    await openRemitsTab();

    const line1 = await screen.findByRole('table', { name: 'Remit details for line 1' });
    expect(cellTexts(within(line1).getByText('Charge').closest('tr'))[0]).toBe('08/14/2026');
  });

  it("opens each line's details by default and collapses them from the toggle", async () => {
    getBillingClaimDetailMock.mockResolvedValue(claimWithRemits());
    renderDetail();
    await openRemitsTab();

    const toggle = await screen.findByRole('button', { name: 'Toggle remit details for line 1' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table', { name: 'Remit details for line 1' })).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() =>
      expect(screen.queryByRole('table', { name: 'Remit details for line 1' })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('table', { name: 'Remit details for line 2' })).toBeInTheDocument();
  });

  it('shows remit lines that are not on the claim as service lines built from the ERA', async () => {
    getBillingClaimDetailMock.mockResolvedValue(
      claimWithRemits({
        remits: [
          {
            ...remit,
            serviceLines: [
              ...remit.serviceLines,
              makeRemitLine({
                itemSequence: null,
                claimItemSequence: null,
                isClaimLevel: true,
                serviceDate: '',
                units: null,
                adjustments: [{ groupCode: 'OA', reasonCode: '23', amount: 2 }],
              }),
              // the payer adjudicated a code we didn't bill
              makeRemitLine({
                itemSequence: 3,
                claimItemSequence: null,
                cptCode: '99214',
                billed: 150,
                allowed: 90,
                paid: 90,
                adjustments: [{ groupCode: 'CO', reasonCode: '45', amount: 60 }],
              }),
            ],
          },
        ],
      })
    );
    renderDetail();
    await openRemitsTab();

    expect(await screen.findByText('Claim-level & unmatched remit lines')).toBeInTheDocument();

    const codedRow = screen
      .getByRole('button', { name: 'Toggle remit details for 99214 (not on claim)' })
      .closest('tr');
    expect(cellTexts(codedRow)).toEqual(['', 'ERA', '2026-08-14', '99214', '-', '-', '-', '1 UN', '$150.00']);
    const codedLedger = screen.getByRole('table', { name: 'Remit details for 99214 (not on claim)' });
    expect(within(codedLedger).queryByText('Charge')).not.toBeInTheDocument();
    expect(cellTexts(within(codedLedger).getByText('CO-45').closest('tr'))[4]).toBe('$60.00');

    const claimLevelRow = screen
      .getByRole('button', { name: 'Toggle remit details for claim-level adjustments' })
      .closest('tr') as HTMLElement;
    expect(cellTexts(claimLevelRow)).toEqual(['', 'ERA', '-', 'Claim-level', '-', '-', '-', '-', '-']);
    const claimLevelLedger = screen.getByRole('table', { name: 'Remit details for claim-level adjustments' });
    expect(cellTexts(within(claimLevelLedger).getByText('OA-23').closest('tr'))[4]).toBe('$2.00');

    // the claim-level adjustments come after the lines the payer adjudicated
    expect(codedRow?.compareDocumentPosition(claimLevelRow) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('highlights a remit line with its remit and check on hover, and opens its card only from a CARC label', async () => {
    const user = userEvent.setup();
    getBillingClaimDetailMock.mockResolvedValue(claimWithRemits());
    renderDetail();
    await openRemitsTab();

    const line1 = await screen.findByRole('table', { name: 'Remit details for line 1' });
    const remitRow = within(screen.getByRole('table', { name: 'Remits' }))
      .getByRole('link', { name: 'CHK00012347' })
      .closest('tr');
    const payments = screen.getByRole('table', { name: 'Insurance payments' });
    const checkRow = within(payments).getByRole('link', { name: 'CHK00012347' }).closest('tr');
    const otherCheckRow = within(payments).getByRole('link', { name: 'CHK00012345' }).closest('tr');

    // anywhere on the remit's rows lights up its remit and check, but opens no card, even past the
    // card's enter delay
    await user.hover(within(line1).getByText('Employers Mutual'));
    expect(remitRow).toHaveClass('Mui-selected');
    expect(checkRow).toHaveClass('Mui-selected');
    expect(otherCheckRow).not.toHaveClass('Mui-selected');
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    const co45 = within(line1).getByText('CO-45');
    await user.hover(co45);

    const card = await screen.findByRole('tooltip');
    expect(within(card).getByText('Employers Mutual')).toBeInTheDocument();
    expect(within(card).getByText('Primary')).toBeInTheDocument();
    expect(
      within(card).getByText('Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement.')
    ).toBeInTheDocument();
    expect(within(card).getByText('Co-payment amount.')).toBeInTheDocument();
    expect(within(card).getByText('$40.21')).toBeInTheDocument();
    expect(within(card).getByText('CHK00012347')).toBeInTheDocument();
    expect(within(card).getByText('08/22/2026')).toBeInTheDocument();
    expect(within(card).getByText('Adjudicated as A7020')).toBeInTheDocument();
    expect(remitRow).toHaveClass('Mui-selected');
    expect(checkRow).toHaveClass('Mui-selected');
    expect(otherCheckRow).not.toHaveClass('Mui-selected');

    // moving to the line's other CARC label keeps its card and highlight up
    const pr3 = within(line1).getByText('PR-3');
    await user.hover(pr3);
    // the previous label's card finishes closing while this one opens
    await waitFor(() => {
      expect(screen.getAllByRole('tooltip')).toHaveLength(1);
      expect(remitRow).toHaveClass('Mui-selected');
    });
    expect(within(screen.getByRole('tooltip')).getByText('Co-payment amount.')).toBeInTheDocument();
    expect(checkRow).toHaveClass('Mui-selected');

    // leaving the remit's rows clears both
    await user.unhover(pr3);

    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    expect(remitRow).not.toHaveClass('Mui-selected');
    expect(checkRow).not.toHaveClass('Mui-selected');
  });

  it('highlights a remit line with its remit and check while one of its CARC labels has focus', async () => {
    getBillingClaimDetailMock.mockResolvedValue(claimWithRemits());
    renderDetail();
    await openRemitsTab();

    const line1 = await screen.findByRole('table', { name: 'Remit details for line 1' });
    const remitRow = within(screen.getByRole('table', { name: 'Remits' }))
      .getByRole('link', { name: 'CHK00012347' })
      .closest('tr');
    const label = within(line1).getByText('CO-45').closest('[tabindex="0"]') as HTMLElement;

    act(() => label.focus());
    expect(remitRow).toHaveClass('Mui-selected');

    act(() => label.blur());
    expect(remitRow).not.toHaveClass('Mui-selected');
  });

  it('totals the allowed amount, insurance paid by payer rank, and what the patient owes', async () => {
    getBillingClaimDetailMock.mockResolvedValue(
      claimWithRemits({
        remits: [
          makeRemit({ claimResponseId: 'cr-secondary', eraStatusCode: '2', paid: 10, paymentReconciliationId: 'pr-2' }),
          remit,
        ],
      })
    );
    renderDetail();
    await openRemitsTab();

    const totals = await screen.findByRole('group', { name: 'Remit totals' });
    expect(within(totals).getByText('$176.83')).toBeInTheDocument();
    expect(within(totals).getByText('Primary')).toBeInTheDocument();
    expect(within(totals).getByText('$136.83')).toBeInTheDocument();
    expect(within(totals).getByText('Secondary')).toBeInTheDocument();
    expect(within(totals).getByText('$10.00')).toBeInTheDocument();
    expect(within(totals).getByText('$40.00')).toBeInTheDocument();
    expect(within(totals).getByText('$60.00')).toBeInTheDocument();
    expect(within(totals).getByText('-$20.00')).toBeInTheDocument();
  });

  it('shows the service lines as before when no ERA is matched', async () => {
    getBillingClaimDetailMock.mockResolvedValue(claimWithRemits({ remits: [], insurancePayments: [] }));
    renderDetail();
    await openRemitsTab();

    const cptCell = await screen.findByText('A7020');
    const table = cptCell.closest('table') as HTMLElement;
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
    ).toEqual(['#', 'Date of Service', 'CPT Code', 'Modifiers', 'Dx', 'POS', 'Qty', 'Billed']);
    expect(screen.queryByRole('button', { name: /Toggle remit details/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Charge')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Remit totals' })).not.toBeInTheDocument();
  });
});

describe('ClaimDetail — run rules engine button', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
    runBillingRulesEngineMock.mockReset();
    enqueueSnackbarMock.mockReset();
  });

  it('shows Submit claim for a claim in Insurance Payer AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Submit claim' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Prepare for invoice' })).not.toBeInTheDocument();
  });

  it('shows Prepare for invoice for a claim in Non-insurance Payer AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.nonInsurancePayer));
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Prepare for invoice' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Submit claim' })).not.toBeInTheDocument();
  });

  it('shows Prepare for invoice for a self-pay claim in Patient AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient)); // coverageFhirId '' -> self-pay
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Prepare for invoice' })).toBeEnabled();
  });

  it('shows Prepare for invoice for a Patient AR claim with insurance coverage', async () => {
    getBillingClaimDetailMock.mockResolvedValue({ ...makeClaim(AR_STAGE.patient), coverageFhirId: 'coverage-1' });
    renderDetail();

    const prepareButton = await screen.findByRole('button', { name: 'Prepare for invoice' });
    expect(prepareButton).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Submit claim' })).not.toBeInTheDocument();
  });

  it('hides the run button when the claim has no AR stage', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(''));
    renderDetail();
    await screen.findByText('No AR Stage');
    expect(screen.queryByRole('button', { name: 'Prepare for invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit claim' })).not.toBeInTheDocument();
  });

  it('runs the claim submission rules through the confirm dialog', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    runBillingRulesEngineMock.mockResolvedValue({
      results: [{ claimId: 'claim-1', taskId: 'task-1', engine: 'claim-submission' }],
    });
    renderDetail();

    const submitButton = await screen.findByRole('button', { name: 'Submit claim' });
    fireEvent.click(submitButton);

    const confirmButton = await screen.findByRole('button', { name: 'Run rules' });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimIds: ['claim-1'], skipRules: false })
    );
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Claim Submission Rules started — when every rule passes, the claim is submitted to the payer; a Hold keeps the claim for review. Refresh to see the result.',
      { variant: 'info' }
    );
  });

  it('runs the pre-invoice rules through the Prepare for invoice dialog', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.nonInsurancePayer));
    runBillingRulesEngineMock.mockResolvedValue({
      results: [{ claimId: 'claim-1', taskId: 'task-1', engine: 'non-insurance-payer-pre-invoice' }],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Prepare for invoice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Run rules' }));

    await waitFor(() =>
      expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimIds: ['claim-1'], skipRules: false })
    );
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Non-Insurance Payer Pre-Invoice Rules started — when every rule passes, the Non-insurance AR Status moves to Ready to invoice; a Hold keeps the claim for review. Refresh to see the result.',
      { variant: 'info' }
    );
  });
});

describe('ClaimDetail — patient payments', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('lists patient payments, including a negative refund', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      patientPayments: [
        {
          paymentNoticeId: 'pn-1',
          paymentDate: '2026-07-10',
          amount: 60,
          method: 'check',
          description: 'check collected at front desk',
          checkNumber: '1234',
          status: 'active',
        },
        {
          paymentNoticeId: 'pn-2',
          paymentDate: '2026-07-11',
          amount: -20,
          method: 'card',
          description: 'partial refund',
          status: 'active',
        },
      ],
    });
    renderDetail();

    const paymentsTab = await screen.findByRole('tab', { name: 'Write offs & Patient payments' });
    fireEvent.click(paymentsTab);

    const paymentRow = (await screen.findByText('check collected at front desk')).closest('tr');
    expect(paymentRow).not.toBeNull();
    const paymentCells = within(paymentRow as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(paymentCells).toEqual(['07/10/2026', 'check', 'check collected at front desk', '1234', 'active', '$60.00']);

    const refundRow = (await screen.findByText('partial refund')).closest('tr');
    const refundCells = within(refundRow as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(refundCells).toEqual(['07/11/2026', 'card', 'partial refund', '-', 'active', '-$20.00']);
  });

  it('shows the empty state when the claim has no patient payments', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient));
    renderDetail();

    const paymentsTab = await screen.findByRole('tab', { name: 'Write offs & Patient payments' });
    fireEvent.click(paymentsTab);

    expect(await screen.findByText('No patient payments yet')).toBeInTheDocument();
  });
});

describe('ClaimDetail — provisional balance indicator', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('flags the balance as provisional when the claim is not adjudicated', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      adjudicated: false,
    });
    renderDetail();

    expect(await screen.findByRole('img', { name: PROVISIONAL_BALANCE_HINT })).toBeInTheDocument();
  });

  it('does not flag the balance once the claim is adjudicated', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      adjudicated: true,
    });
    renderDetail();

    await screen.findAllByText('Jane Doe');
    expect(screen.queryByRole('img', { name: PROVISIONAL_BALANCE_HINT })).not.toBeInTheDocument();
  });
});

describe('ClaimDetail — header copy buttons', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('copies the claim id and the pcn from the header', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      pcn: 'claim1',
    });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText,
      },
      writable: true,
      configurable: true,
    });
    renderDetail();

    const copyClaimId = await screen.findByRole('button', { name: 'Copy Claim ID' });
    await user.click(copyClaimId);
    expect(writeText).toHaveBeenCalledWith('claim-1');

    const copyPcn = screen.getByRole('button', { name: 'Copy PCN' });
    await user.click(copyPcn);
    expect(writeText).toHaveBeenCalledWith('CLAIM1');
  });

  it('offers no copy button for an empty pcn', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      pcn: '',
    });
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Copy Claim ID' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy PCN' })).not.toBeInTheDocument();
  });
});

describe('ClaimDetail: notes drawer', () => {
  const noteMessage = 'Called payer, on hold pending medical records';
  const noteEntry = {
    id: 'prov-note',
    recorded: '2026-06-01T12:00:00Z',
    activity: 'Note',
    actor: {
      display: 'Jane Doe',
      type: 'user' as const,
    },
    changes: [],
    message: noteMessage,
  };

  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient));
    getBillingClaimHistoryMock.mockReset();
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [] });
    addBillingClaimNoteMock.mockReset();
    addBillingClaimNoteMock.mockResolvedValue({ ok: true });
  });

  it('opens the notes drawer from the header button', async () => {
    const user = userEvent.setup();
    renderDetail();

    const notesButton = await screen.findByRole('button', { name: 'Notes' });
    await user.click(notesButton);

    expect(await screen.findByLabelText('Add a note')).toBeInTheDocument();
  });

  it('drops an unsent draft when the user moves to another claim', async () => {
    const otherClaim = {
      id: 'claim-2',
      status: '',
      arStage: AR_STAGE.patient,
      serviceDate: '2026-01-02',
      payerName: 'Acme Health',
      billed: 100,
      cptCodes: ['99213'],
    };
    getBillingClaimDetailMock.mockImplementation((_client: unknown, { claimId }: { claimId: string }) =>
      Promise.resolve({
        ...makeClaim(AR_STAGE.patient),
        id: claimId,
        otherClaims: claimId === 'claim-1' ? [otherClaim] : [],
      })
    );
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Notes' }));
    const draft = await screen.findByLabelText('Add a note');
    fireEvent.change(draft, { target: { value: 'draft for the first claim' } });
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('tab', { name: 'Other claims' }));
    await user.click(await screen.findByText('claim-2'));

    await user.click(await screen.findByRole('button', { name: 'Notes' }));
    expect(await screen.findByLabelText('Add a note')).toHaveValue('');
  });

  it('shows a note posted from the drawer on the already-open History tab', async () => {
    const user = userEvent.setup();
    renderDetail();

    const historyTab = await screen.findByRole('tab', { name: 'History' });
    await user.click(historyTab);
    await waitFor(() => expect(getBillingClaimHistoryMock).toHaveBeenCalled());
    expect(screen.getByText('No history recorded for this claim yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notes' }));
    const input = await screen.findByLabelText('Add a note');
    fireEvent.change(input, { target: { value: noteMessage } });

    getBillingClaimHistoryMock.mockResolvedValue({ entries: [noteEntry] });
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(addBillingClaimNoteMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Close' }));

    const historyTable = await screen.findByRole('table');
    expect(within(historyTable).getByText(noteMessage)).toBeInTheDocument();
    expect(within(historyTable).getByText('Note')).toBeInTheDocument();
  });
});
