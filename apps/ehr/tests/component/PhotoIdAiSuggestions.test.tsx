import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, type InputHTMLAttributes, ReactNode } from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import type { PhotoIdExtractionFields } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================
// Plain <input> so the container-level test doesn't fight react-imask (SSN / ZIP / phone masks).
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

// SectionSaveButton (rendered in both containers' headers) needs the account-update mutation.
vi.mock('../../src/hooks/useGetPatient', () => ({
  useUpdatePatientAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemovePatientCoverage: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock the extraction hook: the containers must never invoke OCR or FHIR reads in this test.
// buildPhotoIdOptionSuggestion stays REAL so the birth-sex / state dropdown mapping is exercised.
let mockedPhotoId: { fields: PhotoIdExtractionFields | null; isLoading: boolean } = {
  fields: null,
  isLoading: false,
};
vi.mock('../../src/features/visits/shared/components/patient/usePhotoIdExtraction', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/features/visits/shared/components/patient/usePhotoIdExtraction')
  >('../../src/features/visits/shared/components/patient/usePhotoIdExtraction');
  return { ...actual, usePhotoIdExtraction: () => mockedPhotoId };
});

// Imported AFTER the mocks so they take effect.
import { AboutPatientContainer } from '../../src/features/visits/shared/components/patient/AboutPatientContainer';
import { ContactContainer } from '../../src/features/visits/shared/components/patient/ContactContainer';

// ============================================================================
// FIXTURES & HARNESS
// ============================================================================
const rowTestId = (fieldKey: string): string => `insurance-card-ai-suggestion-${fieldKey}`;
const ACCEPT_BUTTON_NAME = /use value from card/i;

const makePhotoIdFields = (overrides: Partial<PhotoIdExtractionFields> = {}): PhotoIdExtractionFields => ({
  firstName: null,
  middleName: null,
  lastName: null,
  suffix: null,
  dateOfBirth: null,
  sex: null,
  addressLine1: null,
  addressCity: null,
  addressState: null,
  addressZip: null,
  licenseNumber: null,
  expirationDate: null,
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

const renderWithForm = (children: ReactNode, defaultValues: Record<string, unknown>): { current?: UseFormReturn } => {
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
// TESTS — AboutPatientContainer (patient summary)
// ============================================================================
describe('AboutPatientContainer photo-ID suggestions', () => {
  beforeEach(() => {
    mockedPhotoId = { fields: null, isLoading: false };
  });

  const makeSummaryDefaults = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    'patient-first-name': '',
    'patient-middle-name': '',
    'patient-last-name': '',
    'patient-name-suffix': '',
    'patient-preferred-name': '',
    'patient-birthdate': '',
    'patient-birth-sex': '',
    ...overrides,
  });

  const renderContainer = (defaults: Record<string, unknown>): { current?: UseFormReturn } =>
    renderWithForm(<AboutPatientContainer isLoading={false} patientId="patient-1" />, defaults);

  it('renders a suggestion row only for mismatched or empty fields, never for matching ones', () => {
    mockedPhotoId = {
      fields: makePhotoIdFields({
        firstName: 'JOHN',
        lastName: 'Doe',
        suffix: 'JR',
        dateOfBirth: '1990-01-02',
        sex: 'Male',
      }),
      isLoading: false,
    };
    renderContainer(makeSummaryDefaults({ 'patient-first-name': 'Jane', 'patient-last-name': 'doe' }));

    // Mismatch → row with the extracted value and a straight "+".
    const firstNameRow = screen.getByTestId(rowTestId('patient-first-name'));
    expect(within(firstNameRow).getByText('JOHN')).toBeInTheDocument();
    expect(within(firstNameRow).getByRole('button', { name: ACCEPT_BUTTON_NAME })).toBeInTheDocument();

    // Case-insensitive match ("doe" vs "Doe") → nothing renders.
    expect(screen.queryByTestId(rowTestId('patient-last-name'))).not.toBeInTheDocument();
    // Field the extraction has no value for → nothing renders.
    expect(screen.queryByTestId(rowTestId('patient-middle-name'))).not.toBeInTheDocument();

    // Empty form fields → rows render.
    expect(screen.getByTestId(rowTestId('patient-name-suffix'))).toBeInTheDocument();
    expect(screen.getByTestId(rowTestId('patient-birthdate'))).toBeInTheDocument();
    expect(screen.getByTestId(rowTestId('patient-birth-sex'))).toBeInTheDocument();
  });

  it('"+" writes the extracted value with shouldDirty and flips to the accepted check state', async () => {
    mockedPhotoId = { fields: makePhotoIdFields({ firstName: 'JOHN' }), isLoading: false };
    const user = userEvent.setup();
    const methodsRef = renderContainer(makeSummaryDefaults({ 'patient-first-name': 'Jane' }));

    const row = screen.getByTestId(rowTestId('patient-first-name'));
    await user.click(within(row).getByRole('button', { name: ACCEPT_BUTTON_NAME }));

    expect(methodsRef.current?.getValues('patient-first-name')).toBe('JOHN');
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
    expect(screen.getByTestId(`${rowTestId('patient-first-name')}-accepted`)).toBeInTheDocument();
  });

  it('maps the extracted sex to the birth-sex dropdown option case-insensitively and accepts it', async () => {
    mockedPhotoId = { fields: makePhotoIdFields({ sex: 'FEMALE' }), isLoading: false };
    const user = userEvent.setup();
    const methodsRef = renderContainer(makeSummaryDefaults());

    // The row shows the value as printed on the ID; accepting writes the option VALUE.
    const row = screen.getByTestId(rowTestId('patient-birth-sex'));
    expect(within(row).getByText('FEMALE')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: ACCEPT_BUTTON_NAME }));

    expect(methodsRef.current?.getValues('patient-birth-sex')).toBe('Female');
    expect(screen.getByTestId(`${rowTestId('patient-birth-sex')}-accepted`)).toBeInTheDocument();
  });

  it('renders no birth-sex row when the extracted sex maps to no dropdown option', () => {
    mockedPhotoId = { fields: makePhotoIdFields({ sex: 'X' }), isLoading: false };
    renderContainer(makeSummaryDefaults());

    expect(screen.queryByTestId(rowTestId('patient-birth-sex'))).not.toBeInTheDocument();
  });

  it('renders no suggestion rows when there is no stored extraction', () => {
    renderContainer(makeSummaryDefaults());

    expect(screen.queryByTestId(/insurance-card-ai-suggestion-/)).not.toBeInTheDocument();
  });
});

// ============================================================================
// TESTS — ContactContainer (address fields)
// ============================================================================
describe('ContactContainer photo-ID suggestions', () => {
  beforeEach(() => {
    mockedPhotoId = { fields: null, isLoading: false };
  });

  const makeContactDefaults = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    'patient-street-address': '',
    'patient-street-address-2': '',
    'patient-city': '',
    'patient-state': '',
    'patient-zip': '',
    'patient-email': '',
    'patient-no-email': false,
    'patient-number': '',
    'patient-preferred-communication-method': '',
    ...overrides,
  });

  const renderContainer = (defaults: Record<string, unknown>): { current?: UseFormReturn } =>
    renderWithForm(<ContactContainer isLoading={false} patientId="patient-1" />, defaults);

  it('renders address suggestion rows for mismatched/empty fields and none for matching ones', async () => {
    mockedPhotoId = {
      fields: makePhotoIdFields({
        addressLine1: '123 MAIN ST',
        addressCity: 'Boston',
        addressState: 'ma',
        addressZip: '02134',
      }),
      isLoading: false,
    };
    const user = userEvent.setup();
    const methodsRef = renderContainer(makeContactDefaults({ 'patient-city': 'BOSTON' }));

    // Street / ZIP: empty form fields → straight "+" rows with the extracted values.
    const streetRow = screen.getByTestId(rowTestId('patient-street-address'));
    expect(within(streetRow).getByText('123 MAIN ST')).toBeInTheDocument();
    const zipRow = screen.getByTestId(rowTestId('patient-zip'));
    expect(within(zipRow).getByText('02134')).toBeInTheDocument();

    // Case-insensitive city match → nothing renders.
    expect(screen.queryByTestId(rowTestId('patient-city'))).not.toBeInTheDocument();

    // State: "ma" maps to the "MA" dropdown option; accepting writes the option value.
    const stateRow = screen.getByTestId(rowTestId('patient-state'));
    expect(within(stateRow).getByText('ma')).toBeInTheDocument();
    await user.click(within(stateRow).getByRole('button', { name: ACCEPT_BUTTON_NAME }));
    expect(methodsRef.current?.getValues('patient-state')).toBe('MA');
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
    expect(screen.getByTestId(`${rowTestId('patient-state')}-accepted`)).toBeInTheDocument();
  });

  it('"+" writes the street address with shouldDirty', async () => {
    mockedPhotoId = { fields: makePhotoIdFields({ addressLine1: '123 MAIN ST' }), isLoading: false };
    const user = userEvent.setup();
    const methodsRef = renderContainer(makeContactDefaults({ 'patient-street-address': '9 Old Rd' }));

    const row = screen.getByTestId(rowTestId('patient-street-address'));
    await user.click(within(row).getByRole('button', { name: ACCEPT_BUTTON_NAME }));

    expect(methodsRef.current?.getValues('patient-street-address')).toBe('123 MAIN ST');
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('dirty');
  });

  it('renders no state row when the extracted state maps to no dropdown option', () => {
    mockedPhotoId = { fields: makePhotoIdFields({ addressState: 'ZZ' }), isLoading: false };
    renderContainer(makeContactDefaults());

    expect(screen.queryByTestId(rowTestId('patient-state'))).not.toBeInTheDocument();
  });

  it('renders no suggestion rows when there is no stored extraction', () => {
    renderContainer(makeContactDefaults());

    expect(screen.queryByTestId(/insurance-card-ai-suggestion-/)).not.toBeInTheDocument();
  });
});
