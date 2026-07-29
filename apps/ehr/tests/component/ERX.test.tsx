import { render } from '@testing-library/react';
import { Practitioner } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => enqueueSnackbar(...args),
  closeSnackbar: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}));

let userReturn: { profileResource?: Practitioner; hasRole: () => boolean; id?: string };
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => userReturn,
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    patient: { id: 'patient-1', birthDate: '1980-01-01', telecom: [{ system: 'phone', value: '+1 555 000 1111' }] },
    encounter: { id: 'enc-1' },
  }),
}));

// Vitals present so nothing else blocks; we are exercising the practitioner-profile gate.
vi.mock('../../src/features/visits/shared/hooks/useErxPatientVitals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/visits/shared/hooks/useErxPatientVitals')>();
  return {
    ...actual,
    useErxPatientVitals: () => ({ hasVitals: true, isVitalsLoading: false, isVitalsFetched: true }),
  };
});

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useCheckPractitionerEnrollment: () => ({ data: undefined, isFetched: false, refetch: vi.fn() }),
  useSyncERXPatient: () => ({ isFetched: false, isLoading: false }),
  useEnrollPractitionerToERX: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useConnectPractitionerToERX: () => ({
    data: undefined,
    isPending: false,
    mutateAsync: vi.fn(),
    isSuccess: false,
  }),
}));

vi.mock('../../src/components/dialogs/PendingErxEnrollmentDialog', () => ({
  PendingErxEnrollmentDialog: () => null,
}));

vi.mock('../../src/features/visits/shared/components/ERXDialog', () => ({
  ERXDialog: () => null,
}));

vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureException: vi.fn(),
  safelyCaptureMessage: vi.fn(),
}));

// Real ERX + real getPractitionerMissingFields — this test locks in the prescriber gate.
import { ERX, ERXStatus } from '../../src/features/visits/shared/components/ERX';

const NPI_SYSTEM = 'http://hl7.org/fhir/sid/us-npi';

const completeProfileExceptNpi: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  birthDate: '1980-01-01',
  telecom: [
    { system: 'phone', value: '555-111-2222' },
    { system: 'fax', value: '555-333-4444' },
  ],
  address: [{ line: ['1 Main St'], city: 'Townsville', state: 'CA', postalCode: '90000' }],
};

describe('ERX (prescriber flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userReturn = { profileResource: completeProfileExceptNpi, hasRole: () => false, id: 'prac-1' };
  });

  it('blocks with an ERROR and a "complete your profile" prompt when the provider has no NPI', () => {
    const onStatusChanged = vi.fn();
    render(<ERX onStatusChanged={onStatusChanged} showDefaultAlert={false} />);

    expect(onStatusChanged).toHaveBeenCalledWith(ERXStatus.ERROR);

    const missingFieldsCall = enqueueSnackbar.mock.calls.find(
      ([message]) => typeof message === 'string' && message.includes('Please complete your profile')
    );
    expect(missingFieldsCall).toBeTruthy();
    expect(missingFieldsCall?.[0]).toContain('NPI');
    expect(missingFieldsCall?.[1]).toMatchObject({ variant: 'error', key: 'erx-practitioner-missing-fields' });
  });

  it('does not raise the missing-profile prompt once the provider has all fields incl. NPI', () => {
    userReturn = {
      profileResource: {
        ...completeProfileExceptNpi,
        identifier: [{ system: NPI_SYSTEM, value: '1234567890' }],
      },
      hasRole: () => false,
      id: 'prac-1',
    };

    const onStatusChanged = vi.fn();
    render(<ERX onStatusChanged={onStatusChanged} showDefaultAlert={false} />);

    const missingFieldsCall = enqueueSnackbar.mock.calls.find(
      ([message]) => typeof message === 'string' && message.includes('Please complete your profile')
    );
    expect(missingFieldsCall).toBeFalsy();
  });
});
