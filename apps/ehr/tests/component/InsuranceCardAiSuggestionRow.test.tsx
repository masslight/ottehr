import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
// The same list is the name-only payer source for the carrier suggestion.
const insuranceQuickPicksFixture = [
  { id: 'qp-1', name: 'Aetna', payerId: '60054', organizationReference: 'Organization/aetna' },
  { id: 'qp-2', name: 'BLU-001 - Blue Cross', payerId: 'BLU-001', organizationReference: 'Organization/blue-cross' },
];
vi.mock('src/hooks/useMergedQuickPicks', () => ({
  useMergedInsuranceQuickPicks: () => ({ quickPicks: insuranceQuickPicksFixture, loading: false, refetch: vi.fn() }),
}));

// Short-circuit the carrier dropdown's answer-options query (DynamicReferenceField).
const carrierOptions = [{ reference: 'Organization/aetna', display: 'Aetna' }];
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (args: { queryKey: ReadonlyArray<unknown>; queryFn?: () => Promise<unknown> }) => {
      const keyString = JSON.stringify(args.queryKey);
      if (keyString.includes('get-all-insurance-payers') || keyString.includes('get-answer-options')) {
        return { data: carrierOptions, isLoading: false, isRefetching: false };
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
  });

  it('renders the Oystehr AI suggestion with a "+" when the extracted value differs from the form value', () => {
    renderWithForm(
      <InsuranceCardAiSuggestionRow fieldKey={FIELD_KEY} suggestedDisplay="W123456" suggestedFormValue="W123456" />,
      { [FIELD_KEY]: 'OLD-999' }
    );

    const row = screen.getByTestId(ROW_TEST_ID);
    expect(within(row).getByText('Oystehr AI')).toBeInTheDocument();
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

  it('renders an informational suggestion without a "+" when there is no acceptable form value', () => {
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
  });
});

// ============================================================================
// TESTS — mounted in InsuranceContainer (extraction hook mocked)
// ============================================================================
describe('InsuranceContainer insurance-card suggestions', () => {
  beforeEach(() => {
    mockedExtraction = { primary: null, secondary: null, isLoading: false };
  });

  const makeContainerDefaults = (): Record<string, unknown> => ({
    'insurance-priority': 'Primary',
    'insurance-carrier': null,
    'insurance-plan-type': '',
    'insurance-member-id': 'OLD-999',
    'patient-relationship-to-insured': '',
    'insurance-additional-information': '',
  });

  const renderContainer = (): { current?: UseFormReturn } =>
    renderWithForm(
      <InsuranceContainer ordinal={1} patientId="patient-1" isNew renderWithoutSection />,
      makeContainerDefaults()
    );

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

    // Carrier: unique name match against the payer list → acceptable suggestion.
    const carrierRow = screen.getByTestId('insurance-card-ai-suggestion-insurance-carrier');
    expect(within(carrierRow).getByRole('button', { name: ACCEPT_BUTTON_NAME })).toBeInTheDocument();

    // Plan type: "PPO" maps to a candid-code option → suggestion present.
    expect(screen.getByTestId('insurance-card-ai-suggestion-insurance-plan-type')).toBeInTheDocument();

    // Additional info composite from group / Rx values.
    const additionalRow = screen.getByTestId('insurance-card-ai-suggestion-insurance-additional-information');
    expect(within(additionalRow).getByText('Group #: 12345; RxBIN: 610014')).toBeInTheDocument();

    // Member ID differs from the form value → "+" writes it for the SectionSaveButton to commit.
    const memberRow = screen.getByTestId(ROW_TEST_ID);
    await user.click(within(memberRow).getByRole('button', { name: ACCEPT_BUTTON_NAME }));
    expect(methodsRef.current?.getValues(FIELD_KEY)).toBe('W123456');
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
  });

  it('renders no suggestions when there is no stored extraction for this ordinal', () => {
    mockedExtraction = { primary: null, secondary: null, isLoading: false };
    renderContainer();

    expect(screen.queryByTestId(ROW_TEST_ID)).not.toBeInTheDocument();
    expect(screen.queryByTestId('insurance-card-ai-suggestion-insurance-carrier')).not.toBeInTheDocument();
  });
});
