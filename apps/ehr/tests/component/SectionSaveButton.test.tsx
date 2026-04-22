import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionnaireResponse } from 'fhir/r4b';
import { FC, ReactNode, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
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

import { SectionSaveButton } from '../../src/features/visits/shared/components/patient/SectionSaveButton';

// ============================================================================
// HELPERS
// ============================================================================

interface HarnessProps {
  defaultValues: Record<string, unknown>;
  dirtyKeys?: string[];
  fieldKeys: string[];
  requiredFieldKeys: string[];
  patientId?: string;
  encounterId?: string;
}

const Harness: FC<HarnessProps> = ({
  defaultValues,
  dirtyKeys = [],
  fieldKeys,
  requiredFieldKeys,
  patientId,
  encounterId,
}) => {
  const methods = useForm<Record<string, unknown>>({ defaultValues, mode: 'onChange' });
  useEffect(() => {
    dirtyKeys.forEach((key) => {
      methods.setValue(key, `${defaultValues[key] ?? ''}-edited`, { shouldDirty: true });
    });
  }, [dirtyKeys, defaultValues, methods]);
  return (
    <FormProvider {...methods}>
      <SectionSaveButton
        fieldKeys={fieldKeys}
        requiredFieldKeys={requiredFieldKeys}
        patientId={patientId}
        encounterId={encounterId}
      />
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
      requiredFieldKeys: ['patient-email'],
      patientId: 'p1',
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /save/i })).toBeNull());
  });

  it('renders the Save button once a section field is dirty', async () => {
    renderHarness({
      defaultValues: { 'patient-email': 'a@b.co' },
      dirtyKeys: ['patient-email'],
      fieldKeys: ['patient-email'],
      requiredFieldKeys: ['patient-email'],
      patientId: 'p1',
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument());
  });

  it('disables the button when a required field is empty', async () => {
    renderHarness({
      defaultValues: { 'patient-email': '' },
      dirtyKeys: ['patient-phone'],
      fieldKeys: ['patient-email', 'patient-phone'],
      requiredFieldKeys: ['patient-email'],
      patientId: 'p1',
    });
    // dirty via patient-phone → button appears, but patient-email is empty → disabled
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /save/i });
      expect(btn).toBeDisabled();
    });
  });

  it('submits a scoped QR containing only this section when clicked', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValueOnce(undefined);
    renderHarness({
      defaultValues: { 'patient-email': 'a@b.co', 'other-section-field': 'untouched' },
      dirtyKeys: ['patient-email'],
      fieldKeys: ['patient-email'],
      requiredFieldKeys: ['patient-email'],
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

  it('keeps the Save button visible and shows a snackbar on mutation failure', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValueOnce(new Error('boom'));
    renderHarness({
      defaultValues: { 'patient-email': 'a@b.co' },
      dirtyKeys: ['patient-email'],
      fieldKeys: ['patient-email'],
      requiredFieldKeys: ['patient-email'],
      patientId: 'p1',
    });

    const btn = await screen.findByRole('button', { name: /save/i });
    await user.click(btn);

    await waitFor(() => expect(snackbarMock).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
