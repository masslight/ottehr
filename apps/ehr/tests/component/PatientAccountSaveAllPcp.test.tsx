import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient, Practitioner, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { ServiceMode } from 'utils/lib/types/common';
import { PRACTICE_NAME_URL } from 'utils/lib/types/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { submitQRMock, accountDataRef, coveragesData } = vi.hoisted(() => ({
  submitQRMock: vi.fn(),
  accountDataRef: { current: undefined as unknown },
  coveragesData: { coverages: {}, insuranceOrgs: [] },
}));

vi.mock('src/hooks/useGetPatient', () => ({
  useGetPatientAccount: () => ({ data: accountDataRef.current, isFetching: false, status: 'success' }),
  useGetPatientCoverages: () => ({ data: coveragesData, isFetching: false }),
  useUpdatePatientAccount: () => ({ mutateAsync: submitQRMock, isPending: false }),
  useRemovePatientCoverage: () => ({ mutate: vi.fn() }),
  useGetPatient: () => ({ otherPatientsWithSameName: false, setOtherPatientsWithSameName: vi.fn() }),
}));
vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({ useOystehrAPIClient: () => null }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({ contacts: [] }),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/features/visits/shared/components/patient/patientRecordValidation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/features/visits/shared/components/patient/patientRecordValidation')>()),
  createDynamicValidationResolver: () => async (values: Record<string, unknown>) => ({ values, errors: {} }),
}));

vi.mock('src/features/visits/shared/components/patient/ContactContainer', async () => {
  const { useFormContext } = await import('react-hook-form');
  return {
    ContactContainer: () => {
      const { register } = useFormContext();
      return <input aria-label="Email" {...register('patient-email')} />;
    },
  };
});
vi.mock('src/features/visits/shared/components/patient/AboutPatientContainer', () => ({
  AboutPatientContainer: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/PatientDetailsContainer', () => ({
  PatientDetailsContainer: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/InsuranceSection', () => ({ InsuranceSection: () => null }));
vi.mock('src/features/visits/shared/components/patient/ResponsibleInformationContainer', () => ({
  ResponsibleInformationContainer: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/EmployerInformationContainer', () => ({
  EmployerInformationContainer: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/OccupationalMedicineEmployerContainer', () => ({
  OccupationalMedicineEmployerInformationContainer: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/AttorneyInformationContainer', () => ({
  AttorneyInformationContainer: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/EmergencyContactContainer', () => ({
  EmergencyContactContainer: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/PharmacyContainer', () => ({ PharmacyContainer: () => null }));
vi.mock('src/features/visits/shared/components/patient/Header', () => ({ Header: () => null }));
vi.mock('src/features/visits/shared/components/patient/BreadCrumbs', () => ({ BreadCrumbs: () => null }));
vi.mock('src/components/PatientMergedBanner', () => ({ PatientMergedBanner: () => null }));

import { PatientAccountComponent } from '../../src/pages/PatientInformationPage';

const PCP_REF = { reference: '#primary-care-physician' };

const ACTIVE_PCP: Practitioner = {
  resourceType: 'Practitioner',
  id: 'primary-care-physician',
  active: true,
  name: [{ given: ['Olivia'], family: 'Green' }],
  extension: [{ url: PRACTICE_NAME_URL, valueString: 'Green Family Practice' }],
  telecom: [
    { system: 'phone', value: '+12125559999' },
    { system: 'fax', value: '+12125551234' },
  ],
};
const NO_PCP_CONFIRMED: Practitioner = { resourceType: 'Practitioner', id: 'primary-care-physician', active: false };

const patientWith = (pcp?: Practitioner): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Test'], family: 'Patient' }],
  ...(pcp ? { generalPractitioner: [PCP_REF], contained: [pcp] } : {}),
});

const PCP_STATES: [string, Practitioner | undefined][] = [
  ['unknown', undefined],
  ['confirmed no PCP', NO_PCP_CONFIRMED],
  ['active', ACTIVE_PCP],
];

const PAGES = [
  { page: 'Patient Information', props: {} },
  {
    page: 'Visit Details',
    props: {
      renderBackButton: false,
      appointmentId: 'appointment-1',
      appointmentContext: {
        appointmentServiceCategory: 'urgent-care',
        appointmentServiceMode: ServiceMode['in-person'],
        reasonForVisit: 'Cough',
        encounterId: 'encounter-1',
      },
      confirmSave: (proceed: () => Promise<void>) => proceed(),
    },
  },
];

const pcpSection = (qr: QuestionnaireResponse): QuestionnaireResponseItem | undefined =>
  qr.item?.find((section) => section.linkId === 'primary-care-physician-section');

const sentItem = (qr: QuestionnaireResponse, linkId: string): QuestionnaireResponseItem | undefined =>
  qr.item?.flatMap((section) => section.item ?? []).find((item) => item.linkId === linkId);

const pcpCheckbox = (): HTMLInputElement => document.querySelector('input[name="pcp-active"]') as HTMLInputElement;
const pcpInput = (key: string): HTMLInputElement => document.querySelector(`input[name="${key}"]`) as HTMLInputElement;

describe.each(PAGES)('$page Save All', ({ props }) => {
  const user = userEvent.setup();

  beforeEach(() => {
    submitQRMock.mockReset().mockResolvedValue(undefined);
  });

  const renderWith = async (pcp?: Practitioner): Promise<void> => {
    accountDataRef.current = {
      patient: patientWith(pcp),
      primaryCarePhysician: pcp,
      coverages: {},
      insuranceOrgs: [],
      coverageChecks: [],
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PatientAccountComponent id="patient-1" {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect(pcpCheckbox()).toBeInTheDocument());
  };

  const saveAll = async (): Promise<QuestionnaireResponse> => {
    await user.click(screen.getByRole('button', { name: 'Save All' }));
    await waitFor(() => expect(submitQRMock).toHaveBeenCalledTimes(1));
    return submitQRMock.mock.calls[0][0];
  };

  it.each(PCP_STATES)('leaves an untouched PCP section (%s) out when other details are saved', async (_, pcp) => {
    await renderWith(pcp);

    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    const qr = await saveAll();

    expect(sentItem(qr, 'patient-email')?.answer).toEqual([{ valueString: 'new@example.com' }]);
    expect(pcpSection(qr)).toBeUndefined();
  });

  it('sends a ticked No PCP checkbox', async () => {
    await renderWith(ACTIVE_PCP);

    await user.click(pcpCheckbox());
    const qr = await saveAll();

    expect(sentItem(qr, 'pcp-active')?.answer).toEqual([{ valueBoolean: false }]);
  });

  it('sends an unticked No PCP checkbox', async () => {
    await renderWith(NO_PCP_CONFIRMED);

    expect(pcpCheckbox()).toBeChecked();
    await user.click(pcpCheckbox());
    const qr = await saveAll();

    expect(sentItem(qr, 'pcp-active')?.answer).toEqual([{ valueBoolean: true }]);
  });

  it('leaves the PCP section out when the checkbox is ticked and unticked again', async () => {
    await renderWith(ACTIVE_PCP);

    await user.click(pcpCheckbox());
    await user.click(pcpCheckbox());
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    const qr = await saveAll();

    expect(pcpSection(qr)).toBeUndefined();
  });

  it('sends an edited PCP detail', async () => {
    await renderWith(ACTIVE_PCP);

    await user.clear(pcpInput('pcp-first'));
    await user.type(pcpInput('pcp-first'), 'Olive');
    const qr = await saveAll();

    expect(sentItem(qr, 'pcp-first')?.answer).toEqual([{ valueString: 'Olive' }]);
    expect(sentItem(qr, 'pcp-active')?.answer).toEqual([{ valueBoolean: true }]);
  });

  it('sends a cleared PCP detail as an explicit clear', async () => {
    await renderWith(ACTIVE_PCP);

    await user.clear(pcpInput('pcp-first'));
    const qr = await saveAll();

    expect(sentItem(qr, 'pcp-first')?.answer).toEqual([]);
  });
});
