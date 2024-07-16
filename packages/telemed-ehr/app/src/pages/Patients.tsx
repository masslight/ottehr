import { TabPanel } from '@mui/lab';
import { Button, Grid, Paper } from '@mui/material';
import { BatchInputGetRequest, FhirClient, SearchParam } from '@zapehr/sdk';
import { Bundle, Patient, RelatedPerson } from 'fhir/r4';
import { FormEvent, ReactElement, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PatientSearch from '../components/PatientSearch';
import PatientsTable from '../components/PatientsTable';
import PhoneSearch from '../components/PhoneSearch';
import { encodePlusSign } from '../helpers/encodePlusSign';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

async function getPatientsAndRelatedPersons(
  searchParams: SearchParam[],
  submittedPhone: string | null,
  fhirClient: FhirClient,
): Promise<{
  patients: Patient[] | null;
  relatedPersons: RelatedPerson[] | null;
  total: number;
}> {
  // Search for Patients
  const patientBundle = await fhirClient.searchResourcesReturnBundle({
    resourceType: 'Patient',
    searchParams: searchParams,
  });

  const extractedPatients = patientBundle.entry
    ?.filter((entry) => entry.resource?.resourceType === 'Patient')
    .map((entry) => entry.resource as Patient);

  // Search for RelatedPersons
  let extractedRelatedPersons = null;
  if (extractedPatients?.length) {
    const digits = submittedPhone?.replace(/\D/g, '');
    const phoneSearch = submittedPhone ? `phone=${digits},+1${digits}` : 'phone:missing=false';

    const relatedPersonRequests: BatchInputGetRequest[] = extractedPatients.map((patient) => {
      return {
        method: 'GET',
        url: encodePlusSign(
          `/RelatedPerson?patient=Patient/${patient.id}&relationship=user-relatedperson&${phoneSearch}`,
        ),
      };
    });

    const relatedPersonBundle = await fhirClient.batchRequest({
      requests: relatedPersonRequests,
    });

    const existingRelatedPersonBundle = relatedPersonBundle?.entry?.filter((entry) => entry?.resource);

    extractedRelatedPersons = existingRelatedPersonBundle
      ?.map((entry) => {
        const innerBundle = entry?.resource as Bundle;
        const relatedPerson = innerBundle?.entry?.[0]?.resource as RelatedPerson;
        return relatedPerson || null;
      })
      .filter((relatedPerson) => relatedPerson !== null);
  }

  return {
    patients: extractedPatients ?? null,
    relatedPersons: extractedRelatedPersons ?? null,
    total: patientBundle.total ?? 0,
  };
}

export default function PatientsPage(): ReactElement {
  const { fhirClient } = useApiClients();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [relatedPersons, setRelatedPersons] = useState<RelatedPerson[] | null>(null);
  const [patientNameFilter, setPatientNameFilter] = useState<string | null>(null);
  const [phoneFilter, setPhoneFilter] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState<string | null>(searchParams.get('name'));
  const [submittedPhone, setSubmittedPhone] = useState<string | null>(searchParams.get('phone'));
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Update query params in the url when filters change
  useEffect(() => {
    if (location.search && !submittedName && !submittedPhone) {
      navigate('/patients', { replace: true });
    } else if (submittedName || submittedPhone) {
      const nameParam = submittedName && `name=${submittedName}`;
      const phoneParam = submittedPhone && `phone=${submittedPhone?.replace(/\D/g, '')}`;
      let queryParams;

      if (nameParam && phoneParam) {
        queryParams = [nameParam, phoneParam].join('&');
      } else if (nameParam) {
        queryParams = nameParam;
      } else {
        queryParams = phoneParam;
      }

      navigate(`/patients?${queryParams}`, { replace: true });
    }
  }, [location.search, navigate, submittedName, submittedPhone]);

  // If there are query params in the url then update the filters so the search fields are prefilled when the page loads
  useEffect(() => {
    if (submittedName || submittedPhone) {
      submittedName && setPatientNameFilter(submittedName);
      submittedPhone && setPhoneFilter(submittedPhone);
    }
  }, [submittedName, submittedPhone]);

  // Fetch patients when filters change
  useEffect(() => {
    async function setPatientsAndRelatedPersons(): Promise<void> {
      if (
        !fhirClient ||
        (!submittedName && !submittedPhone) ||
        (submittedName && submittedName?.length < 3) ||
        (submittedPhone && submittedPhone?.length < 10)
      ) {
        return;
      }

      setLoading(true);

      const fhirSearchParams: SearchParam[] = getPatientNameSearchParams({ submittedName: submittedName || undefined });
      const digits = submittedPhone?.replace(/\D/g, '');
      if (submittedPhone) {
        fhirSearchParams.push({ name: '_has:RelatedPerson:patient:phone', value: `${digits},+1${digits}` });
      } else {
        fhirSearchParams.push({ name: '_has:RelatedPerson:patient:phone:missing', value: 'false' });
      }

      const resources = await getPatientsAndRelatedPersons(fhirSearchParams, submittedPhone, fhirClient);

      setPatients(resources.patients);
      setRelatedPersons(resources.relatedPersons);
      setTotalPatients(resources.total);
    }

    setPatientsAndRelatedPersons()
      .catch((error) => console.log(error))
      .finally(() => setLoading(false));
  }, [fhirClient, submittedName, submittedPhone]);

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmittedName(patientNameFilter);
    setSubmittedPhone(phoneFilter);
  };

  return (
    <PageContainer>
      <TabPanel value={'Patients'} sx={{ p: 0 }}>
        <Paper sx={{ p: 2 }}>
          <form onSubmit={(event) => handleFormSubmit(event)}>
            <Grid container spacing={2} display="flex" alignItems="center">
              <Grid item xs={12} sm={5} sx={{ marginTop: 2 }}>
                <PatientSearch
                  nameFilter={patientNameFilter}
                  setNameFilter={setPatientNameFilter}
                  onClear={() => {
                    setPatients(null);
                    setRelatedPersons(null);
                    setTotalPatients(0);
                    setSubmittedName(null);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={5} sx={{ marginTop: 2.5 }}>
                <PhoneSearch
                  phoneFilter={phoneFilter}
                  setPhoneFilter={setPhoneFilter}
                  onClear={() => {
                    setPatients(null);
                    setRelatedPersons(null);
                    setTotalPatients(0);
                    setSubmittedPhone(null);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button type="submit" variant="contained" fullWidth>
                  Submit
                </Button>
              </Grid>
            </Grid>
          </form>
          <PatientsTable
            fhirPatients={patients}
            relatedPersons={relatedPersons}
            total={totalPatients}
            patientsLoading={loading}
          />
        </Paper>
      </TabPanel>
    </PageContainer>
  );
}
