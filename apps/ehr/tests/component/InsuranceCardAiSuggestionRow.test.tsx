import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Reference } from 'fhir/r4b';
import { FC, type InputHTMLAttributes, ReactNode } from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import type { InsuranceCardExtractionFields } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================
// Plain <input> so the container-level test doesn't fight react-imask.
vi.mock('../../src/components/InputMask', () => ({
  default: ({
    onChange,
    value,
    unmask: _unmask,
    ...rest
  }: InputHTMLAttributes<HTMLInputElement> & { unmask?: boolean }) => (
    <input {...rest} onChange={onChange} value={value as string | undefined} />
  ),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: undefined, oystehrZambda: { zambda: { execute: vi.fn() } } }),
}));

// InsuranceContainer renders <InsuranceCarrierQuickPicks>, which needs the quick picks hook.
const insuranceQuickPicksFixture = [
  { id: 'qp-1', name: 'Aetna', payerId: '60054', organizationReference: 'Organization/aetna' },
  { id: 'qp-2', name: 'BLU-001 - Blue Cross', payerId: 'BLU-001', organizationReference: 'Organization/blue-cross' },
];
vi.mock('src/hooks/useMergedQuickPicks', () => ({
  useMergedInsuranceQuickPicks: () => ({ quickPicks: insuranceQuickPicksFixture, loading: false, refetch: vi.fn() }),
}));

// Short-circuit the get-all-insurance-payers options query. This is both what the carrier
// dropdown (DynamicReferenceField) offers AND the payer source the carrier AI suggestion
// resolves candidates against — mutable so each test can shape the directory.
let mockedCarrierOptions: Reference[] = [{ reference: 'Organization/aetna', display: 'Aetna' }];
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (args: { queryKey: ReadonlyArray<unknown>; queryFn?: () => Promise<unknown> }) => {
      const keyString = JSON.stringify(args.queryKey);
      if (keyString.includes('get-all-insurance-payers') || keyString.includes('get-answer-options')) {
        return { data: mockedCarrierOptions, isLoading: false, isRefetching: false };
      }
      return actual.useQuery(args as any);
    },
  };
});

// Mock the extraction hook: the container must never invoke OCR or FHIR reads in this test.
let mockedExtraction: {
  primary: InsuranceCardExtractionFields | null;
  secondary: InsuranceCardExtractionFields | null;
  isLoading: boolean;
} = { primary: null, secondary: null, isLoading: false };
vi.mock('../../src/features/visits/shared/components/patient/useInsuranceCardExtraction', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/features/visits/shared/components/patient/useInsuranceCardExtraction')
  >('../../src/features/visits/shared/components/patient/useInsuranceCardExtraction');
  return { ...actual, useInsuranceCardExtraction: () => mockedExtraction };
});

// Imported AFTER the mocks so they take effect.
import { InsuranceCardAiSuggestionRow } from '../../src/features/visits/shared/components/patient/InsuranceCardAiSuggestionRow';
import { InsuranceContainer } from '../../src/features/visits/shared/components/patient/InsuranceContainer';

// ============================================================================
// FIXTURES & HARNESS
// ============================================================================
const FIELD_KEY = 'insurance-member-id';
const ROW_TEST_ID = `insurance-card-ai-suggestion-${FIELD_KEY}`;
const CARRIER_FIELD_KEY = 'insurance-carrier';
const CARRIER_ROW_TEST_ID = `insurance-card-ai-suggestion-${CARRIER_FIELD_KEY}`;
const ACCEPT_BUTTON_NAME = /use value from card/i;

const makeExtractionFields = (
  overrides: Partial<InsuranceCardExtractionFields> = {}
): InsuranceCardExtractionFields => ({
  payer: null,
  memberName: null,
  memberId: null,
  groupNumber: null,
  payerId: null,
  rxBin: null,
  rxPcn: null,
  rxGroup: null,
  insuranceType: null,
  effectiveDate: null,
  ...overrides,
});

// formState is a lazy proxy — isDirty only updates for subscribers, so render it.
const DirtyProbe: FC<{ methods: UseFormReturn }> = ({ methods }) => (
  <div data-testid="dirty-probe">{methods.formState.isDirty ? 'dirty' : 'clean'}</div>
);

const Harness: FC<{
  defaultValues: Record<string, unknown>;
  methodsRef: { current?: UseFormReturn };
  children: ReactNode;
}> = ({ defaultValues, methodsRef, children }) => {
  const methods = useForm({ defaultValues });
  methodsRef.current = methods;
  return (
    <FormProvider {...methods}>
      {children}
      <DirtyProbe methods={methods} />
    </FormProvider>
  );
};

const renderWithForm = (
  children: ReactNode,
  defaultValues: Record<string, unknown> = { [FIELD_KEY]: '' }
): { current?: UseFormReturn } => {
  const methodsRef: { current?: UseFormReturn } = {};
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Harness defaultValues={defaultValues} methodsRef={methodsRef}>
        {children}
      </Harness>
    </QueryClientProvider>
  );
  return methodsRef;
};

// ============================================================================
// TESTS — row behavior
// ============================================================================
describe('InsuranceCardAiSuggestionRow', () => {
  beforeEach(() => {
    mockedExtraction = { primary: null, secondary: null, isLoading: false };
    mockedCarrierOptions = [{ reference: 'Organization/aetna', display: 'Aetna' }];
  });

  it('renders the Oystehr AI suggestion with a "+" when the extracted value differs from the form value', () => {
    renderWithForm(
      <InsuranceCardAiSuggestionRow fieldKey={FIELD_KEY} suggestedDisplay="W123456" suggestedFormValue="W123456" />,
      { [FIELD_KEY]: 'OLD-999' }
    );

    const row = screen.getByTestId(ROW_TEST_ID);
    // Icon-only badge: the Oystehr AI icon renders, without "Oystehr AI" / "On card:" text labels.
    expect(within(row).getByAltText('Oystehr AI')).toBeInTheDocument();
    expect(within(row).queryByText('Oystehr AI')).not.toBeInTheDocument();
    expect(within(row).queryByText(/On card/)).not.toBeInTheDocument();
    expect(within(row).getByText('W123456')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: ACCEPT_BUTTON_NAME })).toBeInTheDocument();
  });

  it('renders the suggestion when the field is empty', () => {
    renderWithForm(
      <InsuranceCardAiSuggestionRow fieldKey={FIELD_KEY} suggestedDisplay="W123456" suggestedFormValue="W123456" />
    );

    expect(screen.getByTestId(ROW_TEST_ID)).toBeInTheDocument();
  });

  it('renders nothing when the extracted value matches the form value', () => {
    renderWithForm(
      <InsuranceCardAiSuggestionRow fieldKey={FIELD_KEY} suggestedDisplay="W123456" suggestedFormValue="W123456" />,
      { [FIELD_KEY]: 'w123456' }
    );

    expect(screen.queryByTestId(ROW_TEST_ID)).not.toBeInTheDocument();
  });

  it('renders nothing on an alphanumeric-insensitive member-ID match (W123-456 vs W123456)', () => {
    renderWithForm(
      <InsuranceCardAiSuggestionRow
        fieldKey={FIELD_KEY}
        suggestedDisplay="W123456"
        suggestedFormValue="W123456"
        compareAlphanumericOnly
      />,
      { [FIELD_KEY]: 'W123-456' }
    );

    expect(screen.queryByTestId(ROW_TEST_ID)).not.toBeInTheDocument();
  });

  it('"+" writes the suggested value with shouldDirty and flips to the accepted check state', async () => {
    const user = userEvent.setup();
    const methodsRef = renderWithForm(
      <InsuranceCardAiSuggestionRow fieldKey={FIELD_KEY} suggestedDisplay="W123456" suggestedFormValue="W123456" />,
      { [FIELD_KEY]: '' }
    );

    await user.click(screen.getByRole('button', { name: ACCEPT_BUTTON_NAME }));

    expect(methodsRef.current?.getValues(FIELD_KEY)).toBe('W123456');
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
    expect(screen.getByTestId(`${ROW_TEST_ID}-accepted`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACCEPT_BUTTON_NAME })).not.toBeInTheDocument();
  });

  it('renders an informational suggestion without a "+" or picker when there is no acceptable form value', () => {
    renderWithForm(
      <InsuranceCardAiSuggestionRow
        fieldKey={FIELD_KEY}
        suggestedDisplay="Aetna Better Health"
        suggestedFormValue={null}
      />,
      { [FIELD_KEY]: '' }
    );

    const row = screen.getByTestId(ROW_TEST_ID);
    expect(within(row).getByText('Aetna Better Health')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: ACCEPT_BUTTON_NAME })).not.toBeInTheDocument();
    expect(within(row).queryByTestId(`${ROW_TEST_ID}-picker`)).not.toBeInTheDocument();
  });

  it('candidate picker: clicking the highlighted term opens "Matches for", picking writes the value and flips to the check', async () => {
    const user = userEvent.setup();
    const candidates = [
      {
        label: 'Blue Cross Blue Shield',
        formValue: { reference: 'Organization/bcbs', display: 'Blue Cross Blue Shield' },
      },
      {
        label: 'Blue Shield of California',
        formValue: { reference: 'Organization/bs-ca', display: 'Blue Shield of California' },
      },
    ];
    const methodsRef = renderWithForm(
      <InsuranceCardAiSuggestionRow
        fieldKey={FIELD_KEY}
        suggestedDisplay="Blue Shield"
        suggestedFormValue={null}
        candidates={candidates}
        getCurrentComparable={(value) => (value as { display?: string } | null)?.display ?? ''}
      />,
      { [FIELD_KEY]: null }
    );

    // No straight accept-"+": ambiguous suggestions resolve through the picker (its own "+"
    // opens the popover instead — exercised in the no-candidates test below).
    expect(screen.queryByRole('button', { name: ACCEPT_BUTTON_NAME })).not.toBeInTheDocument();

    await user.click(screen.getByTestId(`${ROW_TEST_ID}-picker`));
    expect(screen.getByText(/Matches for/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Blue Shield of California' }));

    expect(methodsRef.current?.getValues(FIELD_KEY)).toEqual({
      reference: 'Organization/bs-ca',
      display: 'Blue Shield of California',
    });
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
    expect(screen.getByTestId(`${ROW_TEST_ID}-accepted`)).toBeInTheDocument();
    expect(screen.queryByText(/Matches for/)).not.toBeInTheDocument();
  });

  it('candidate picker with no candidates shows the "No matches found" state instead of a dead row', async () => {
    const user = userEvent.setup();
    renderWithForm(
      <InsuranceCardAiSuggestionRow
        fieldKey={FIELD_KEY}
        suggestedDisplay="Obscure Payer Co"
        suggestedFormValue={null}
        candidates={[]}
      />,
      { [FIELD_KEY]: '' }
    );

    // Picker rows also render a "+"; it opens the same matches popover as the highlighted term.
    await user.click(screen.getByRole('button', { name: 'Find matches' }));
    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS — mounted in InsuranceContainer (extraction hook mocked)
// ============================================================================
describe('InsuranceContainer insurance-card suggestions', () => {
  beforeEach(() => {
    mockedExtraction = { primary: null, secondary: null, isLoading: false };
    mockedCarrierOptions = [{ reference: 'Organization/aetna', display: 'Aetna' }];
  });

  const makeContainerDefaults = (): Record<string, unknown> => ({
    'insurance-priority': 'Primary',
    'insurance-carrier': null,
    'insurance-plan-type': '',
    'insurance-member-id': 'OLD-999',
    'patient-relationship-to-insured': '',
    'insurance-additional-information': '',
  });

  const renderContainer = (defaults: Record<string, unknown> = makeContainerDefaults()): { current?: UseFormReturn } =>
    renderWithForm(<InsuranceContainer ordinal={1} patientId="patient-1" isNew renderWithoutSection />, defaults);

  it('additional-info "+" appends to existing text instead of overwriting it', async () => {
    mockedExtraction = {
      primary: makeExtractionFields({ groupNumber: '12345', rxBin: '610014' }),
      secondary: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer({
      ...makeContainerDefaults(),
      'insurance-additional-information': 'Pre-existing staff note',
    });

    const additionalRow = screen.getByTestId('insurance-card-ai-suggestion-insurance-additional-information');
    // The pill shows just the card-derived text, not the existing note.
    expect(within(additionalRow).getByText('Group #: 12345; RxBIN: 610014')).toBeInTheDocument();

    await user.click(within(additionalRow).getByRole('button', { name: ACCEPT_BUTTON_NAME }));

    // Accept appends to (rather than replaces) the pre-existing note.
    expect(methodsRef.current?.getValues('insurance-additional-information')).toBe(
      'Pre-existing staff note; Group #: 12345; RxBIN: 610014'
    );
    expect(
      screen.getByTestId(`insurance-card-ai-suggestion-insurance-additional-information-accepted`)
    ).toBeInTheDocument();
  });

  it('does not re-offer the additional-info suggestion once its text is already present in the field', () => {
    mockedExtraction = {
      primary: makeExtractionFields({ groupNumber: '12345' }),
      secondary: null,
      isLoading: false,
    };
    renderContainer({
      ...makeContainerDefaults(),
      'insurance-additional-information': 'Some note; Group #: 12345; more notes',
    });

    // Already incorporated (not merely a fresh accept in this session) → renders nothing.
    expect(
      screen.queryByTestId('insurance-card-ai-suggestion-insurance-additional-information')
    ).not.toBeInTheDocument();
  });

  it('renders per-field suggestions from the primary extraction and accepts the member ID via "+"', async () => {
    mockedExtraction = {
      primary: makeExtractionFields({
        payer: 'Aetna',
        memberId: 'W123456',
        insuranceType: 'PPO',
        groupNumber: '12345',
        rxBin: '610014',
      }),
      secondary: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer();

    // Carrier: unique strong match against the payer directory → one-click acceptable suggestion.
    const carrierRow = screen.getByTestId(CARRIER_ROW_TEST_ID);
    expect(within(carrierRow).getByRole('button', { name: ACCEPT_BUTTON_NAME })).toBeInTheDocument();

    // Plan type: "PPO" maps to a candid-code option → suggestion present.
    expect(screen.getByTestId('insurance-card-ai-suggestion-insurance-plan-type')).toBeInTheDocument();

    // Additional info composite from group / Rx values.
    const additionalRow = screen.getByTestId('insurance-card-ai-suggestion-insurance-additional-information');
    expect(within(additionalRow).getByText('Group #: 12345; RxBIN: 610014')).toBeInTheDocument();

    // Member ID differs from the form value → straight "+" writes it (no picker for member ID).
    const memberRow = screen.getByTestId(ROW_TEST_ID);
    expect(within(memberRow).queryByTestId(`${ROW_TEST_ID}-picker`)).not.toBeInTheDocument();
    await user.click(within(memberRow).getByRole('button', { name: ACCEPT_BUTTON_NAME }));
    expect(methodsRef.current?.getValues(FIELD_KEY)).toBe('W123456');
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
  });

  it('near-miss carrier ("BlueCross BlueShield" vs directory "Blue Cross Blue Shield") strong-matches to a one-click "+"', async () => {
    mockedCarrierOptions = [
      { reference: 'Organization/aetna', display: '60054 - Aetna' },
      { reference: 'Organization/bcbs', display: 'BLU001 - Blue Cross Blue Shield' },
    ];
    mockedExtraction = {
      primary: makeExtractionFields({ payer: 'BlueCross BlueShield' }),
      secondary: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer();

    const carrierRow = screen.getByTestId(CARRIER_ROW_TEST_ID);
    // One-click pill shows the resolved directory label — exactly what "+" writes — not the raw card name.
    expect(within(carrierRow).getByText('BLU001 - Blue Cross Blue Shield')).toBeInTheDocument();
    expect(within(carrierRow).queryByText('BlueCross BlueShield')).not.toBeInTheDocument();
    await user.click(within(carrierRow).getByRole('button', { name: ACCEPT_BUTTON_NAME }));

    // Accept writes the same { reference, display } shape a pick in the carrier field stores.
    expect(methodsRef.current?.getValues(CARRIER_FIELD_KEY)).toEqual({
      reference: 'Organization/bcbs',
      display: 'BLU001 - Blue Cross Blue Shield',
    });
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
    expect(screen.getByTestId(`${CARRIER_ROW_TEST_ID}-accepted`)).toBeInTheDocument();
  });

  it('ambiguous carrier opens the candidate picker and picking writes the payer reference', async () => {
    mockedCarrierOptions = [
      { reference: 'Organization/bcbs', display: 'Blue Cross Blue Shield' },
      { reference: 'Organization/bs-ca', display: 'Blue Shield of California' },
    ];
    mockedExtraction = {
      primary: makeExtractionFields({ payer: 'Blue Shield' }),
      secondary: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer();

    // Ambiguous → no one-click "+", the highlighted term opens the picker instead.
    const carrierRow = screen.getByTestId(CARRIER_ROW_TEST_ID);
    expect(within(carrierRow).queryByRole('button', { name: ACCEPT_BUTTON_NAME })).not.toBeInTheDocument();
    // Picker mode keeps the raw extracted term as the clickable text.
    expect(within(carrierRow).getByTestId(`${CARRIER_ROW_TEST_ID}-picker`)).toHaveTextContent('Blue Shield');
    await user.click(within(carrierRow).getByTestId(`${CARRIER_ROW_TEST_ID}-picker`));

    expect(screen.getByText(/Matches for/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Blue Shield of California' }));

    expect(methodsRef.current?.getValues(CARRIER_FIELD_KEY)).toEqual({
      reference: 'Organization/bs-ca',
      display: 'Blue Shield of California',
    });
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
    expect(screen.getByTestId(`${CARRIER_ROW_TEST_ID}-accepted`)).toBeInTheDocument();
  });

  it('payer-ID single directory match resolves the carrier one-click and omits "Payer ID:" from additional info', async () => {
    mockedCarrierOptions = [
      { reference: 'Organization/aetna', display: '60054 - Aetna' },
      { reference: 'Organization/bcbs', display: 'BLU001 - Blue Cross Blue Shield' },
    ];
    mockedExtraction = {
      // Name matches nothing in the directory — resolution must come from the payer ID alone.
      primary: makeExtractionFields({
        payer: 'Totally Unrecognizable Payer Name',
        payerId: '60054',
        groupNumber: '12345',
      }),
      secondary: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer();

    const carrierRow = screen.getByTestId(CARRIER_ROW_TEST_ID);
    expect(within(carrierRow).queryByTestId(`${CARRIER_ROW_TEST_ID}-picker`)).not.toBeInTheDocument();
    // ID-resolved one-click pill shows the resolved "PAYERID - Name" label, not the raw card name.
    expect(within(carrierRow).getByText('60054 - Aetna')).toBeInTheDocument();
    expect(within(carrierRow).queryByText('Totally Unrecognizable Payer Name')).not.toBeInTheDocument();
    await user.click(within(carrierRow).getByRole('button', { name: ACCEPT_BUTTON_NAME }));
    expect(methodsRef.current?.getValues(CARRIER_FIELD_KEY)).toEqual({
      reference: 'Organization/aetna',
      display: '60054 - Aetna',
    });
    expect(screen.getByTestId(`${CARRIER_ROW_TEST_ID}-accepted`)).toBeInTheDocument();

    // Carrier resolved by the payer ID → the ID is not duplicated into additional information.
    const additionalRow = screen.getByTestId('insurance-card-ai-suggestion-insurance-additional-information');
    expect(within(additionalRow).getByText('Group #: 12345')).toBeInTheDocument();
    expect(within(additionalRow).queryByText(/Payer ID/)).not.toBeInTheDocument();
  });

  it('payer-ID with several directory matches opens a "Payers for ID" picker scoped to those matches', async () => {
    mockedCarrierOptions = [
      { reference: 'Organization/aetna', display: '60054 - Aetna' },
      { reference: 'Organization/aetna-bh', display: '60054 - Aetna Better Health' },
      { reference: 'Organization/bcbs', display: 'BLU001 - Blue Cross Blue Shield' },
    ];
    mockedExtraction = {
      primary: makeExtractionFields({ payer: 'Aetna', payerId: '60054' }),
      secondary: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer();

    // Ambiguous ID → no one-click "+"; the picker is scoped to the ID-matched payers.
    const carrierRow = screen.getByTestId(CARRIER_ROW_TEST_ID);
    expect(within(carrierRow).queryByRole('button', { name: ACCEPT_BUTTON_NAME })).not.toBeInTheDocument();
    await user.click(within(carrierRow).getByTestId(`${CARRIER_ROW_TEST_ID}-picker`));

    expect(screen.getByText("Payers for ID '60054'")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60054 - Aetna' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60054 - Aetna Better Health' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'BLU001 - Blue Cross Blue Shield' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '60054 - Aetna Better Health' }));
    expect(methodsRef.current?.getValues(CARRIER_FIELD_KEY)).toEqual({
      reference: 'Organization/aetna-bh',
      display: '60054 - Aetna Better Health',
    });
    expect(screen.getByTestId(`${CARRIER_ROW_TEST_ID}-accepted`)).toBeInTheDocument();

    // Not uniquely resolved by the ID → the ID stays in additional information so it isn't lost.
    const additionalRow = screen.getByTestId('insurance-card-ai-suggestion-insurance-additional-information');
    expect(within(additionalRow).getByText('Payer ID: 60054')).toBeInTheDocument();
  });

  it('payer-ID with no directory match falls back to name matching and keeps "Payer ID:" in additional info', async () => {
    mockedCarrierOptions = [
      { reference: 'Organization/aetna', display: '60054 - Aetna' },
      { reference: 'Organization/bcbs', display: 'BLU001 - Blue Cross Blue Shield' },
    ];
    mockedExtraction = {
      primary: makeExtractionFields({ payer: 'BlueCross BlueShield', payerId: 'ZZZ999' }),
      secondary: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer();

    // Unknown ID → the existing name strong-match still yields a one-click "+".
    const carrierRow = screen.getByTestId(CARRIER_ROW_TEST_ID);
    await user.click(within(carrierRow).getByRole('button', { name: ACCEPT_BUTTON_NAME }));
    expect(methodsRef.current?.getValues(CARRIER_FIELD_KEY)).toEqual({
      reference: 'Organization/bcbs',
      display: 'BLU001 - Blue Cross Blue Shield',
    });

    // Carrier was resolved by NAME, not the ID → the unmatched ID is preserved.
    const additionalRow = screen.getByTestId('insurance-card-ai-suggestion-insurance-additional-information');
    expect(within(additionalRow).getByText('Payer ID: ZZZ999')).toBeInTheDocument();
  });

  it('renders no suggestions when there is no stored extraction for this ordinal', () => {
    mockedExtraction = { primary: null, secondary: null, isLoading: false };
    renderContainer();

    expect(screen.queryByTestId(ROW_TEST_ID)).not.toBeInTheDocument();
    expect(screen.queryByTestId(CARRIER_ROW_TEST_ID)).not.toBeInTheDocument();
  });
});
