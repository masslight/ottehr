import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ERXStatus is an enum from ./ERX; mock the module so importing it doesn't pull in the full
// prescriber flow (dialogs, enrollment hooks, etc.). Component + test share these mock values.
vi.mock('../../src/features/visits/shared/components/ERX', () => ({
  ERXStatus: { INITIAL: 0, LOADING: 1, READY: 2, ERROR: 3 },
  ERX: () => null,
}));

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => enqueueSnackbar(...args),
  closeSnackbar: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    patient: { id: 'patient-1', telecom: [{ system: 'phone', value: '+1 555 000 1111' }] },
    encounter: { id: 'enc-1' },
  }),
}));

let erxConfigReturn: { data?: { configured?: boolean }; isFetched: boolean };
vi.mock('../../src/features/visits/telemed/hooks/useGetErxConfig', () => ({
  useGetErxConfigQuery: () => erxConfigReturn,
}));

let vitalsReturn: { hasVitals: boolean; isVitalsLoading: boolean; isVitalsFetched: boolean };
// Keep the real getErxPatientSyncErrorMessage; only stub the hook so we can drive vitals state.
vi.mock('../../src/features/visits/shared/hooks/useErxPatientVitals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/visits/shared/hooks/useErxPatientVitals')>();
  return {
    ...actual,
    useErxPatientVitals: () => vitalsReturn,
  };
});

let syncReturn: { isFetched: boolean; isLoading: boolean };
let capturedSyncOnError: ((error: { code?: string; message?: string }) => void) | undefined;
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useSyncERXPatient: (opts: { onError?: (error: { code?: string; message?: string }) => void }) => {
    capturedSyncOnError = opts?.onError;
    return syncReturn;
  },
}));

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureException: vi.fn(),
  safelyCaptureMessage: vi.fn(),
}));

// Imported after the mocks so it picks up the mocked ERXStatus.
import { ERXStatus } from '../../src/features/visits/shared/components/ERX';
import { ERXInteractionsReadiness } from '../../src/features/visits/shared/components/ERXInteractionsReadiness';

describe('ERXInteractionsReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSyncOnError = undefined;
    erxConfigReturn = { data: { configured: true }, isFetched: true };
    vitalsReturn = { hasVitals: true, isVitalsLoading: false, isVitalsFetched: true };
    syncReturn = { isFetched: true, isLoading: false };
  });

  it('reaches READY once eRx is configured, vitals are present, and the patient is synced', () => {
    const onStatusChanged = vi.fn();
    render(<ERXInteractionsReadiness onStatusChanged={onStatusChanged} />);

    expect(onStatusChanged).toHaveBeenLastCalledWith(ERXStatus.READY);
    // Regression: no practitioner-enrollment gate, so no missing-profile/NPI error is raised.
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it('reports LOADING while the eRx configuration is still resolving', () => {
    erxConfigReturn = { data: undefined, isFetched: false };
    const onStatusChanged = vi.fn();
    render(<ERXInteractionsReadiness onStatusChanged={onStatusChanged} />);

    expect(onStatusChanged).toHaveBeenLastCalledWith(ERXStatus.LOADING);
  });

  it('reports LOADING while vitals are loading', () => {
    vitalsReturn = { hasVitals: false, isVitalsLoading: true, isVitalsFetched: false };
    const onStatusChanged = vi.fn();
    render(<ERXInteractionsReadiness onStatusChanged={onStatusChanged} />);

    expect(onStatusChanged).toHaveBeenLastCalledWith(ERXStatus.LOADING);
  });

  it('reports LOADING while the patient is being synced', () => {
    syncReturn = { isFetched: false, isLoading: true };
    const onStatusChanged = vi.fn();
    render(<ERXInteractionsReadiness onStatusChanged={onStatusChanged} />);

    expect(onStatusChanged).toHaveBeenLastCalledWith(ERXStatus.LOADING);
  });

  it('reports ERROR (without a snackbar) when eRx is not configured for the project', () => {
    erxConfigReturn = { data: { configured: false }, isFetched: true };
    const onStatusChanged = vi.fn();
    render(<ERXInteractionsReadiness onStatusChanged={onStatusChanged} />);

    expect(onStatusChanged).toHaveBeenLastCalledWith(ERXStatus.ERROR);
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it('reports ERROR and prompts for vitals when required vitals are missing', () => {
    vitalsReturn = { hasVitals: false, isVitalsLoading: false, isVitalsFetched: true };
    const onStatusChanged = vi.fn();
    render(<ERXInteractionsReadiness onStatusChanged={onStatusChanged} />);

    expect(onStatusChanged).toHaveBeenLastCalledWith(ERXStatus.ERROR);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab",
      expect.objectContaining({ variant: 'error' })
    );
  });

  it('reports ERROR and surfaces a message when the patient sync fails', () => {
    syncReturn = { isFetched: false, isLoading: false };
    const onStatusChanged = vi.fn();
    render(<ERXInteractionsReadiness onStatusChanged={onStatusChanged} />);

    act(() => capturedSyncOnError?.(new Error('boom') as unknown as { message?: string }));

    expect(onStatusChanged).toHaveBeenLastCalledWith(ERXStatus.ERROR);
    expect(enqueueSnackbar).toHaveBeenCalledWith('Something went wrong while trying to sync patient to eRx', {
      variant: 'error',
    });
  });

  it('does not reference the eRx prescriber-enrollment flow (no NPI / profile gate)', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/features/visits/shared/components/ERXInteractionsReadiness.tsx'),
      'utf8'
    );
    for (const forbidden of [
      'useCheckPractitionerEnrollment',
      'useEnrollPractitionerToERX',
      'useConnectPractitionerToERX',
      'getPractitionerMissingFields',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
