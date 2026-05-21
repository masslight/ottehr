import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Coverage, Patient, QuestionnaireResponse, RelatedPerson } from 'fhir/r4b';
import React, { type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { CoverageWithPriority, OrderedCoveragesWithSubscribers, PATIENT_RECORD_CONFIG } from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================
// Default to a plain <input> so most tests don't fight react-imask. One test
// flips this back to the real component to exercise the ZIP unmask round-trip.
let useRealInputMask = false;
vi.mock('../../src/components/InputMask', async () => {
  const React = await import('react');
  const Real = await vi.importActual<typeof import('../../src/components/InputMask')>('../../src/components/InputMask');
  return {
    default: React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { unmask?: boolean }>(
      ({ onChange, value, unmask: _unmask, ...rest }, ref) => {
        if (useRealInputMask) {
          const RealComponent = Real.default as unknown as React.ComponentType<any>;
          return <RealComponent {...rest} value={value} onChange={onChange} ref={ref} unmask={_unmask} />;
        }
        return <input ref={ref} {...rest} onChange={onChange} value={value as string | undefined} />;
      }
    ),
  };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: undefined, oystehrZambda: { zambda: { execute: vi.fn() } } }),
}));

// Short-circuit the carrier dropdown's network call. The DynamicReferenceField
// uses useQuery to load payer options; return a stable fixture so the
// Autocomplete renders a known option without hitting any backend.
const carrierOptions = [{ reference: 'https://rcm-api.example/payer/J1585', display: '1st Auto & Casualty - MN Only' }];
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

const mutateAsyncMock = vi.fn<(qr: QuestionnaireResponse) => Promise<void>>();
let mutationPending = false;
vi.mock('../../src/hooks/useGetPatient', () => ({
  useUpdatePatientAccount: (onSuccess?: () => Promise<void> | void) => ({
    mutateAsync: async (qr: QuestionnaireResponse) => {
      const result = await mutateAsyncMock(qr);
      await onSuccess?.();
      return result;
    },
    isPending: mutationPending,
  }),
  useRemovePatientCoverage: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Imported AFTER the mocks so they take effect.
import {
  buildInsuranceSectionCounts,
  useCoverageFormRehydration,
} from '../../src/features/visits/shared/components/patient/insuranceFormHelpers';
import { InsuranceSection } from '../../src/features/visits/shared/components/patient/InsuranceSection';
import { createDynamicValidationResolver } from '../../src/features/visits/shared/components/patient/patientRecordValidation';

// ============================================================================
// FIXTURES
// ============================================================================
const PATIENT_ID = 'patient-1';
const PRIMARY_COVERAGE_ID = 'coverage-primary';

const insuranceItems = PATIENT_RECORD_CONFIG.FormFields.insurance.items as Array<Record<string, { key: string }>>;
const PRIMARY = insuranceItems[0];
const SECONDARY = insuranceItems[1];

const fakePatient: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  name: [{ given: ['Pat'], family: 'Iemt' }],
  birthDate: '1990-01-01',
  address: [{ line: ['1 Main St'], city: 'Town', state: 'CA', postalCode: '90210' }],
  gender: 'female',
};

const makeFullPrimaryCoverages = (): OrderedCoveragesWithSubscribers => ({
  primary: {
    resourceType: 'Coverage',
    id: PRIMARY_COVERAGE_ID,
    status: 'active',
    beneficiary: { reference: `Patient/${PATIENT_ID}` },
    payor: [{ reference: 'Organization/payer-1' }],
    class: [{ type: { coding: [{ code: 'plan' }] }, value: 'J1585' }],
    order: 1,
    relationship: { coding: [{ display: 'Self' }] },
  } as Coverage,
  primarySubscriber: {
    resourceType: 'RelatedPerson',
    id: 'related-primary',
    patient: { reference: `Patient/${PATIENT_ID}` },
    name: [{ given: ['Pat'], family: 'Iemt' }],
    gender: 'female',
    birthDate: '1990-01-01',
    address: [{ line: ['1 Main St'], city: 'Town', state: 'CA', postalCode: '90210' }],
  } as RelatedPerson,
});

// Pre-fill the primary slot's form fields as if a saved primary coverage had
// already been hydrated into the form (e.g. the patient is mid-flow adding a
// secondary). Without this the SectionSaveButton gates on the primary
// required fields and the secondary save button never enables.
const seedPrimaryFromCoverage = (defaults: Record<string, unknown>): Record<string, unknown> => ({
  ...defaults,
  [PRIMARY.insurancePriority.key]: 'Primary',
  [PRIMARY.insuranceCarrier.key]: carrierOptions[0],
  [PRIMARY.memberId.key]: 'MEMBER-123',
  [PRIMARY.relationship.key]: 'Self',
  [PRIMARY.policyHolderAddressAsPatient.key]: true,
  [PRIMARY.zip.key]: '90210',
});

// Default form values mirroring an empty patient record so RHF's dirty
// comparison stays sane.
const makeEmptyFormDefaults = (): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {
    'patient-first-name': 'Pat',
    'patient-last-name': 'Iemt',
    'patient-birthdate': '1990-01-01',
    'patient-birth-sex': 'Female',
    'patient-street-address': '1 Main St',
    'patient-street-address-2': '',
    'patient-city': 'Town',
    'patient-state': 'CA',
    'patient-zip': '90210',
  };
  [PRIMARY, SECONDARY].forEach((group) => {
    Object.values(group).forEach((item) => {
      const key = item.key;
      if (key === 'insurance-carrier' || key === 'insurance-carrier-2') {
        defaults[key] = null;
      } else if (key.startsWith('policy-holder-address-as-patient')) {
        defaults[key] = false;
      } else {
        defaults[key] = '';
      }
    });
  });
  return defaults;
};

// Fill the minimum set of primary required fields. Uses relationship=Self so
// policy-holder name/DOB/sex/address fields auto-populate via dynamic
// population — keeps the test focused on the section save path, not on
// poking every MUI dropdown.
const fillRequiredPrimaryFields = (methods: UseFormReturn, zip = '90210'): void => {
  methods.setValue(PRIMARY.insuranceCarrier.key, carrierOptions[0], { shouldDirty: true });
  methods.setValue(PRIMARY.memberId.key, 'MEMBER-123', { shouldDirty: true });
  methods.setValue(PRIMARY.relationship.key, 'Self', { shouldDirty: true });
  methods.setValue(PRIMARY.policyHolderAddressAsPatient.key, true, { shouldDirty: true });
  // policy-holder-zip will be auto-populated by the dynamic-population effect,
  // but providing it explicitly lets tests target ZIP-specific behavior.
  methods.setValue(PRIMARY.zip.key, zip, { shouldDirty: true });
};

const fillRequiredSecondaryFields = (methods: UseFormReturn): void => {
  methods.setValue(SECONDARY.insuranceCarrier.key, carrierOptions[0], { shouldDirty: true });
  methods.setValue(SECONDARY.memberId.key, 'MEMBER-SECONDARY', { shouldDirty: true });
  methods.setValue(SECONDARY.relationship.key, 'Self', { shouldDirty: true });
  methods.setValue(SECONDARY.policyHolderAddressAsPatient.key, true, { shouldDirty: true });
  methods.setValue(SECONDARY.zip.key, '90210', { shouldDirty: true });
};

// ============================================================================
// HARNESS
// ============================================================================
interface HarnessControl {
  setCoverages: (next: OrderedCoveragesWithSubscribers) => void;
  setCoveragesFormValues: (next: Record<string, unknown> | undefined) => void;
  methods: UseFormReturn;
}

interface HarnessProps {
  initialCoverages?: OrderedCoveragesWithSubscribers;
  defaultValues?: Record<string, unknown>;
  controlRef: { current?: HarnessControl };
}

const Harness: React.FC<HarnessProps> = ({ initialCoverages, defaultValues, controlRef }) => {
  const [coverages, setCoveragesState] = useState<OrderedCoveragesWithSubscribers>(initialCoverages ?? {});
  const [coveragesFormValues, setCoveragesFormValuesState] = useState<Record<string, unknown> | undefined>(undefined);

  const orderedCoverages: CoverageWithPriority[] = [];
  if (coverages.primary) orderedCoverages.push({ resource: coverages.primary, startingPriority: 1 });
  if (coverages.secondary) orderedCoverages.push({ resource: coverages.secondary, startingPriority: 2 });

  const newInsuranceOrdinal = orderedCoverages.some((c) => c.startingPriority === 1) ? 2 : 1;
  const [isAddingInsurance, setIsAddingInsurance] = useState(false);

  const renderedSectionCounts = buildInsuranceSectionCounts({
    hasPrimary: Boolean(coverages.primary),
    hasSecondary: Boolean(coverages.secondary),
    isAddingInsurance,
    newInsuranceOrdinal,
  });

  const methods = useForm({
    defaultValues: defaultValues ?? makeEmptyFormDefaults(),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: createDynamicValidationResolver({ renderedSectionCounts }),
  });

  useCoverageFormRehydration({
    coveragesFormValues,
    patientId: PATIENT_ID,
    primaryCoverageId: coverages.primary?.id,
    secondaryCoverageId: coverages.secondary?.id,
    methods,
  });

  // Expose imperative handles for tests once the form is mounted.
  controlRef.current = {
    setCoverages: setCoveragesState,
    setCoveragesFormValues: setCoveragesFormValuesState,
    methods,
  };

  const handleStartAddInsurance = (): void => {
    setIsAddingInsurance(true);
    const index = newInsuranceOrdinal - 1;
    const fields = insuranceItems[index];
    Object.values(fields).forEach((field) => {
      methods.setValue(field.key, '', { shouldDirty: false });
    });
    const priorityValue = newInsuranceOrdinal === 1 ? 'Primary' : 'Secondary';
    methods.setValue(fields.insurancePriority.key, priorityValue, { shouldDirty: true });
  };

  const handleCancelAddInsurance = (): void => setIsAddingInsurance(false);
  const handleCloseAddInsurance = (): void => setIsAddingInsurance(false);

  return (
    <FormProvider {...methods}>
      <InsuranceSection
        coverages={orderedCoverages}
        patient={fakePatient}
        accountData={{ coverageChecks: [] }}
        removeCoverage={{ isPending: false }}
        onRemoveCoverage={() => undefined}
        isAddingInsurance={isAddingInsurance}
        onStartAddInsurance={handleStartAddInsurance}
        onCancelAddInsurance={handleCancelAddInsurance}
        onCloseAddInsurance={handleCloseAddInsurance}
        newInsuranceOrdinal={newInsuranceOrdinal}
      />
    </FormProvider>
  );
};

const renderHarness = (props: Omit<HarnessProps, 'controlRef'> = {}): HarnessControl => {
  const controlRef: { current?: HarnessControl } = {};
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  render(<Harness {...props} controlRef={controlRef} />, { wrapper });
  if (!controlRef.current) throw new Error('Harness did not initialize controlRef');
  return controlRef.current;
};

// Helpers to extract section ids and answers from a posted QR.
const sectionLinkIds = (qr: QuestionnaireResponse): string[] => (qr.item ?? []).map((s) => s.linkId);
const answeredLinkIds = (qr: QuestionnaireResponse, sectionId: string): string[] => {
  const section = qr.item?.find((s) => s.linkId === sectionId);
  return (section?.item ?? []).filter((i) => Boolean(i.answer?.length)).map((i) => i.linkId);
};

// ============================================================================
// TESTS
// ============================================================================
describe('InsuranceSection — section save flow', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue(undefined);
    mutationPending = false;
    useRealInputMask = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens an inline primary form when "Add Insurance" is clicked on an empty patient', async () => {
    const user = userEvent.setup();
    renderHarness();

    const addButton = await screen.findByRole('button', { name: /add insurance/i });
    await user.click(addButton);

    // Once the inline form is open, the SectionSaveButton becomes visible
    // because handleStartAddInsurance seeds insurance-priority as dirty.
    expect(await screen.findByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('submits a QR scoped to insurance-section only when the primary section save fires', async () => {
    const user = userEvent.setup();
    const control = renderHarness();

    await user.click(await screen.findByRole('button', { name: /add insurance/i }));
    act(() => fillRequiredPrimaryFields(control.methods));

    // Save becomes enabled once the required fields are populated.
    const saveButton = await screen.findByRole('button', { name: /^save$/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    const qr = mutateAsyncMock.mock.calls[0][0];

    expect(qr.subject?.reference).toBe(`Patient/${PATIENT_ID}`);
    expect(sectionLinkIds(qr)).toContain('insurance-section');
    expect(sectionLinkIds(qr)).not.toContain('insurance-section-2');

    const primaryAnswers = answeredLinkIds(qr, 'insurance-section');
    expect(primaryAnswers).toEqual(
      expect.arrayContaining([
        'insurance-priority',
        'insurance-carrier',
        'insurance-member-id',
        'patient-relationship-to-insured',
      ])
    );
  });

  it('closes the inline form after a successful save so the new coverage container can claim the same field names without wiping values', async () => {
    const user = userEvent.setup();
    const control = renderHarness();

    await user.click(await screen.findByRole('button', { name: /add insurance/i }));
    act(() => fillRequiredPrimaryFields(control.methods));

    const saveButton = await screen.findByRole('button', { name: /^save$/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());

    // Simulate the refetch landing.
    act(() => control.setCoverages(makeFullPrimaryCoverages()));

    // The "Primary insurance" header rendered by the coverage container should
    // be visible, and the user's just-saved values remain intact in form state.
    await waitFor(() => expect(screen.getByText(/Primary insurance/i)).toBeInTheDocument());
    expect(control.methods.getValues(PRIMARY.memberId.key)).toBe('MEMBER-123');
    expect(control.methods.getValues(PRIMARY.relationship.key)).toBe('Self');
    expect(control.methods.getValues(PRIMARY.insuranceCarrier.key)).toMatchObject(carrierOptions[0]);
  });

  it('keeps the section save button hidden after a primary save lands (form clean — ZIP regression)', async () => {
    const user = userEvent.setup();
    useRealInputMask = true; // exercise the actual IMaskInput emit semantics
    const control = renderHarness();

    await user.click(await screen.findByRole('button', { name: /add insurance/i }));
    // Enter a 9-digit ZIP — the historical bug surfaced specifically on
    // 9-digit ZIPs where the unmasked default mismatched the masked emit.
    act(() => fillRequiredPrimaryFields(control.methods, '222041234'));

    const saveButton = await screen.findByRole('button', { name: /^save$/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());

    // Simulate the refetch returning the canonical (unmasked) ZIP that the
    // backend persisted, then prime the rehydration with it. After this lands
    // the form must NOT report dirty: that's the regression we fixed.
    act(() => {
      control.setCoverages(makeFullPrimaryCoverages());
      const formValues = control.methods.getValues();
      control.setCoveragesFormValues({ ...formValues, [PRIMARY.zip.key]: '222041234' });
    });

    await waitFor(() => expect(screen.getByText(/Primary insurance/i)).toBeInTheDocument());
    // The Section save button is rendered only when the section is dirty. If
    // the ZIP regression came back it would be visible (and enabled).
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
    expect(control.methods.formState.isDirty).toBe(false);
  });

  it('submits the secondary section answers when saving a newly-added secondary insurance', async () => {
    const user = userEvent.setup();
    const control = renderHarness({
      initialCoverages: makeFullPrimaryCoverages(),
      defaultValues: seedPrimaryFromCoverage(makeEmptyFormDefaults()),
    });

    // Primary is already there — clicking Add Insurance opens the secondary slot.
    await user.click(await screen.findByRole('button', { name: /add insurance/i }));
    act(() => fillRequiredSecondaryFields(control.methods));

    const saveButton = await screen.findByRole('button', { name: /^save$/i });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    const qr = mutateAsyncMock.mock.calls[0][0];

    // The unified section-save covers both rendered ordinals — the primary
    // section may also appear (idempotent re-send of the loaded values), but
    // what must be true is that insurance-section-2 carries the new answers.
    expect(sectionLinkIds(qr)).toContain('insurance-section-2');
    const secondaryAnswers = answeredLinkIds(qr, 'insurance-section-2');
    expect(secondaryAnswers).toEqual(
      expect.arrayContaining([
        'insurance-priority-2',
        'insurance-carrier-2',
        'insurance-member-id-2',
        'patient-relationship-to-insured-2',
      ])
    );
  });
});
