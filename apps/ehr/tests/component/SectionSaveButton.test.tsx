import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionnaireResponse } from 'fhir/r4b';
import { FC, ReactNode, useEffect } from 'react';
import { FieldErrors, FormProvider, Resolver, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const snackbarMock = vi.fn();
vi.mock('notistack', async () => {
  const actual = await vi.importActual<typeof import('notistack')>('notistack');
  return {
    ...actual,
    enqueueSnackbar: (...args: unknown[]) => snackbarMock(...args),
  };
});

const mutateAsyncMock = vi.fn<(qr: QuestionnaireResponse) => Promise<void>>();
let mutationPending = false;

// Mirror the real useUpdatePatientAccount hook's behavior: it surfaces
// mutation errors as a snackbar via its onError handler. The component
// relies on that contract rather than catching errors itself.
vi.mock('../../src/hooks/useGetPatient', () => ({
  useUpdatePatientAccount: (onSuccess?: () => void) => ({
    mutateAsync: async (qr: QuestionnaireResponse) => {
      try {
        const result = await mutateAsyncMock(qr);
        snackbarMock('Patient information updated successfully', { variant: 'success' });
        onSuccess?.();
        return result;
      } catch (error) {
        snackbarMock('Save operation failed. The server encountered an error while processing your request.', {
          variant: 'error',
        });
        throw error;
      }
    },
    isPending: mutationPending,
  }),
}));

import { PATIENT_RECORD_QUESTIONNAIRE } from 'utils';
import { SectionSaveButton } from '../../src/features/visits/shared/components/patient/SectionSaveButton';

// ============================================================================
// CONFIG AWARENESS
// ============================================================================

// Instances may hide the SSN field by config (e.g. `hiddenFields: ['patient-ssn']`),
// which omits it from the generated patient-record questionnaire entirely. The SSN-specific
// regression below only applies where SSN is actually configured, so skip it otherwise.
const questionnaireHasLinkId = (linkId: string): boolean => {
  const stack = [...(PATIENT_RECORD_QUESTIONNAIRE().item ?? [])];
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;
    if (item.linkId === linkId) return true;
    if (item.item) stack.push(...item.item);
  }
  return false;
};
const ssnFieldConfigured = questionnaireHasLinkId('patient-ssn');

// ============================================================================
// HELPERS
// ============================================================================

// Mirrors the real form: validation is driven by a resolver (createDynamicValidationResolver
// in production), not by the button. Tests that exercise invalid-field behavior pass a
// resolver that reports errors for the given keys; the rest run without one (always valid).
const makeRequiredResolver =
  (requiredKeys: string[]): Resolver<Record<string, unknown>> =>
  async (values) => {
    const errors: FieldErrors<Record<string, unknown>> = {};
    requiredKeys.forEach((key) => {
      if (!values[key]) {
        errors[key] = { type: 'required', message: 'This field is required' };
      }
    });
    return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} };
  };

interface HarnessProps {
  defaultValues: Record<string, unknown>;
  dirtyKeys?: string[];
  fieldKeys: string[];
  resolver?: Resolver<Record<string, unknown>>;
  patientId?: string;
  encounterId?: string;
}

const Harness: FC<HarnessProps> = ({ defaultValues, dirtyKeys = [], fieldKeys, resolver, patientId, encounterId }) => {
  const methods = useForm<Record<string, unknown>>({ defaultValues, mode: 'onChange', resolver });
  useEffect(() => {
    dirtyKeys.forEach((key) => {
      methods.setValue(key, `${defaultValues[key] ?? ''}-edited`, { shouldDirty: true });
    });
  }, [dirtyKeys, defaultValues, methods]);
  return (
    <FormProvider {...methods}>
      <SectionSaveButton fieldKeys={fieldKeys} patientId={patientId} encounterId={encounterId} />
    </FormProvider>
  );
};

const renderHarness = (props: HarnessProps): ReturnType<typeof render> => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<Harness {...props} />, { wrapper });
};

// ============================================================================
// TESTS
// ============================================================================

describe('SectionSaveButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationPending = false;
    mutateAsyncMock.mockReset();
  });

  it('renders nothing when no field in the section is dirty', async () => {
    renderHarness({
      defaultValues: { 'patient-email': 'a@b.co' },
      fieldKeys: ['patient-email'],
      patientId: 'p1',
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /save/i })).toBeNull());
  });

  it('renders the Save button once a section field is dirty', async () => {
    renderHarness({
      defaultValues: { 'patient-email': 'a@b.co' },
      dirtyKeys: ['patient-email'],
      fieldKeys: ['patient-email'],
      patientId: 'p1',
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument());
  });

  it('stays enabled even when a required field is empty (validation surfaces on click)', async () => {
    renderHarness({
      defaultValues: { 'patient-email': '' },
      dirtyKeys: ['patient-phone'],
      fieldKeys: ['patient-email', 'patient-phone'],
      resolver: makeRequiredResolver(['patient-email']),
      patientId: 'p1',
    });
    // dirty via patient-phone → button appears; patient-email is empty but the
    // button is no longer gated on required fields, so it stays clickable.
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /save/i });
      expect(btn).toBeEnabled();
    });
  });

  it('does not submit and shows an error snackbar when clicked with an invalid field', async () => {
    const user = userEvent.setup();
    renderHarness({
      defaultValues: { 'patient-email': '' },
      dirtyKeys: ['patient-phone'],
      fieldKeys: ['patient-email', 'patient-phone'],
      resolver: makeRequiredResolver(['patient-email']),
      patientId: 'p1',
    });

    const btn = await screen.findByRole('button', { name: /save/i });
    await user.click(btn);

    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith('Please fix all field validation errors and try again', {
        variant: 'error',
      })
    );
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('submits a scoped QR containing only this section when clicked', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValueOnce(undefined);
    renderHarness({
      defaultValues: { 'patient-email': 'a@b.co', 'other-section-field': 'untouched' },
      dirtyKeys: ['patient-email'],
      fieldKeys: ['patient-email'],
      patientId: 'p1',
      encounterId: 'e1',
    });

    const btn = await screen.findByRole('button', { name: /save/i });
    await user.click(btn);

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    const qr = mutateAsyncMock.mock.calls[0][0];
    expect(qr.subject?.reference).toBe('Patient/p1');
    expect(qr.encounter?.reference).toBe('Encounter/e1');
    // No items from the other section
    const allLinkIds = (qr.item ?? []).flatMap((section) => (section.item ?? []).map((i) => i.linkId));
    expect(allLinkIds).not.toContain('other-section-field');
  });

  it.skipIf(!ssnFieldConfigured)(
    'auto-includes the logical control field a section field depends on so the backend keeps the gated field (SSN)',
    async () => {
      // Regression for HOST-942: SSN is gated by `should-display-ssn-field` via enableWhen,
      // which the backend filters on. The caller passes only `patient-ssn`; SectionSaveButton
      // must auto-add the control field or the SSN answer is dropped before harvest.
      const user = userEvent.setup();
      mutateAsyncMock.mockResolvedValueOnce(undefined);
      renderHarness({
        defaultValues: { 'patient-ssn': '123-45-6789', 'should-display-ssn-field': true },
        dirtyKeys: ['patient-ssn'],
        fieldKeys: ['patient-ssn'],
        patientId: 'p1',
      });

      const btn = await screen.findByRole('button', { name: /save/i });
      await user.click(btn);

      await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
      const qr = mutateAsyncMock.mock.calls[0][0];
      const allLinkIds = (qr.item ?? []).flatMap((section) => (section.item ?? []).map((i) => i.linkId));
      expect(allLinkIds).toContain('patient-ssn');
      expect(allLinkIds).toContain('should-display-ssn-field');
      const controlItem = (qr.item ?? [])
        .flatMap((section) => section.item ?? [])
        .find((i) => i.linkId === 'should-display-ssn-field');
      expect(controlItem?.answer?.[0]?.valueBoolean).toBe(true);
    }
  );

  it('keeps the Save button visible and shows a snackbar on mutation failure', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValueOnce(new Error('boom'));
    renderHarness({
      defaultValues: { 'patient-email': 'a@b.co' },
      dirtyKeys: ['patient-email'],
      fieldKeys: ['patient-email'],
      patientId: 'p1',
    });

    const btn = await screen.findByRole('button', { name: /save/i });
    await user.click(btn);

    await waitFor(() => expect(snackbarMock).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
