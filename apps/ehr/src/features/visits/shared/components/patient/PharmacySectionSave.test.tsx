import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormFieldItemRecord } from 'config-types';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormGroupPharmacyCollection } from 'src/components/form';
import { PATIENT_RECORD_CONFIG, PHARMACY_COLLECTION_LINK_IDS } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { SectionSaveButton } from './SectionSaveButton';

// The per-section save submits through this hook; resolve it so handleSave reaches
// the resetField() cleanup that's under test.
const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../../../hooks/useGetPatient', () => ({
  useUpdatePatientAccount: (onSuccess?: () => void) => ({
    mutateAsync: async (qr: unknown) => {
      const result = await mutateAsync(qr);
      onSuccess?.();
      return result;
    },
    isPending: false,
  }),
}));

// FormGroupPharmacyCollection only uses the API client for the (untriggered) places
// search; null is fine for this test.
vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => null,
}));

const preferredPharmacySection = PATIENT_RECORD_CONFIG.FormFields.preferredPharmacy;

const collectFieldKeys = (items: FormFieldItemRecord): string[] =>
  Object.values(items).flatMap((item) =>
    item.type === 'group' ? [item.key, ...collectFieldKeys(item.items)] : [item.key]
  );

const FIELD_KEYS = collectFieldKeys(preferredPharmacySection.items);

interface TestHarnessProps {
  onFormReady: (methods: ReturnType<typeof useForm>) => void;
}

const TestHarness = ({ onFormReady }: TestHarnessProps): JSX.Element => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const Inner = (): JSX.Element => {
    const methods = useForm({
      defaultValues: Object.fromEntries(FIELD_KEYS.map((key) => [key, ''])),
    });

    React.useEffect(() => {
      onFormReady(methods);
    }, [methods]);

    return (
      <FormProvider {...methods}>
        <FormGroupPharmacyCollection />
        <SectionSaveButton fieldKeys={FIELD_KEYS} patientId="patient-123" />
      </FormProvider>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
};

describe('Pharmacy section save', () => {
  const user = userEvent.setup();

  // Mirrors FormGroupPharmacyCollection.handlePlacesPharmacySelection (the dropdown pick).
  const selectPharmacyFromDropdown = (methods: ReturnType<typeof useForm>): void => {
    methods.setValue(PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId, 'erx-1', { shouldDirty: true });
    methods.setValue(PHARMACY_COLLECTION_LINK_IDS.placesAddress, '1 Main St', { shouldDirty: true });
    methods.setValue(PHARMACY_COLLECTION_LINK_IDS.placesId, 'place-1', { shouldDirty: true });
    methods.setValue(PHARMACY_COLLECTION_LINK_IDS.placesName, 'Test Pharmacy', { shouldDirty: true });
    methods.setValue(PHARMACY_COLLECTION_LINK_IDS.placesDataSaved, true, { shouldDirty: true });
  };

  it('hides the Save button after saving a pharmacy picked from the dropdown', async () => {
    let formMethods: ReturnType<typeof useForm> | null = null;
    render(<TestHarness onFormReady={(methods) => (formMethods = methods)} />);

    await waitFor(() => expect(formMethods).not.toBeNull());

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await act(async () => {
      selectPharmacyFromDropdown(formMethods!);
    });

    const saveButton = await screen.findByRole('button', { name: 'Save' });
    expect(saveButton).toBeInTheDocument();

    await user.click(saveButton);

    // After a successful save, resetField() must clear the dirty state of the
    // places fields (registered via FormGroupPharmacyCollection's hidden inputs),
    // so the Save button disappears without a full-form reset.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
});
