import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Organization, Reference } from 'fhir/r4b';
import { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { EMPLOYER_NOTES_EXTENSION_URL } from 'utils/lib/fhir/organization';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fhirGetMock } = vi.hoisted(() => ({ fhirGetMock: vi.fn() }));

// `oystehrZambda` is left undefined so the employer dropdown's answer-options query stays disabled;
// this test only cares about the read-only notes resolved from the selected employer Organization.
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: { fhir: { get: fhirGetMock } }, oystehrZambda: undefined }),
}));

// Remove the occupational-medicine section from hiddenFormSections so PatientRecordFormSection renders
// it regardless of which instance overlay is active.
vi.mock('utils/lib/ottehr-config/patient-record', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/ottehr-config/patient-record')>();
  return {
    ...original,
    PATIENT_RECORD_CONFIG: {
      ...original.PATIENT_RECORD_CONFIG,
      hiddenFormSections: original.PATIENT_RECORD_CONFIG.hiddenFormSections.filter(
        (s: string) => s !== 'occupational-medicine-employer-information-page'
      ),
    },
  };
});

import { OCCUPATIONAL_MEDICINE_EMPLOYER_FIELD_KEY } from '../../visitEmployer';
import { OccupationalMedicineEmployerInformationContainer } from './OccupationalMedicineEmployerContainer';

const EMPLOYER_REFERENCE: Reference = { reference: 'Organization/employer-1', display: 'FedEx International' };
const NOTES = 'Send all results to the HR contact';
const NOTES_LABEL = 'Employer Notes';
// Config-driven; used to assert the section itself rendered.
const SECTION_TITLE = PATIENT_RECORD_CONFIG.FormFields.occupationalMedicineEmployerInformation.title;

const employerOrganization = (notes?: string): Organization => ({
  resourceType: 'Organization',
  id: 'employer-1',
  name: 'FedEx International',
  extension: notes ? [{ url: EMPLOYER_NOTES_EXTENSION_URL, valueString: notes }] : undefined,
});

const Harness: FC<{ employer: Reference | null }> = ({ employer }) => {
  const methods = useForm({ defaultValues: { [OCCUPATIONAL_MEDICINE_EMPLOYER_FIELD_KEY]: employer } });
  return (
    <FormProvider {...methods}>
      <OccupationalMedicineEmployerInformationContainer isLoading={false} patientId="patient-1" />
    </FormProvider>
  );
};

const renderContainer = (employer: Reference | null): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Harness employer={employer} />
    </QueryClientProvider>
  );
};

describe('OccupationalMedicineEmployerInformationContainer employer notes', () => {
  beforeEach(() => {
    fhirGetMock.mockReset();
  });

  it('displays the notes recorded on the selected employer', async () => {
    fhirGetMock.mockResolvedValue(employerOrganization(NOTES));

    renderContainer(EMPLOYER_REFERENCE);

    expect(await screen.findByText(NOTES)).toBeInTheDocument();
    expect(screen.getByText(NOTES_LABEL)).toBeInTheDocument();
    expect(fhirGetMock).toHaveBeenCalledWith({ resourceType: 'Organization', id: 'employer-1' });
  });

  it('omits the notes row when the selected employer has no notes', async () => {
    fhirGetMock.mockResolvedValue(employerOrganization());

    renderContainer(EMPLOYER_REFERENCE);

    await waitFor(() => expect(fhirGetMock).toHaveBeenCalled());
    expect(screen.queryByText(NOTES_LABEL)).toBeNull();
  });

  it('does not look up an employer when none is selected', async () => {
    renderContainer(null);

    await waitFor(() => expect(screen.getByText(SECTION_TITLE)).toBeInTheDocument());
    expect(screen.queryByText(NOTES_LABEL)).toBeNull();
    expect(fhirGetMock).not.toHaveBeenCalled();
  });
});
