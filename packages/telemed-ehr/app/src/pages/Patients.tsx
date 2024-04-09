import { TabPanel } from '@mui/lab';
import { Button, Grid, Paper } from '@mui/material';
import { SearchParam } from '@zapehr/sdk';
import { Patient, RelatedPerson } from 'fhir/r4';
import { FormEvent, ReactElement, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PatientSearch from '../components/PatientSearch';
import PatientsTable from '../components/PatientsTable';
import PhoneSearch from '../components/PhoneSearch';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

export const MAX_RESULTS = 20;
const ENVIRONMENT = import.meta.env.VITE_APP_ENV;

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

  const getPatientsAndRelatedPersons = useCallback(
    async (
      resourceType: string,
      searchParams: SearchParam[],
    ): Promise<{ patients: Patient[] | null; relatedPersons: RelatedPerson[] | null; total: number }> => {
      if (!fhirClient) {
        return { patients: null, relatedPersons: null, total: 0 };
      }

      const bundle = await fhirClient.searchResourcesReturnBundle({
        resourceType: resourceType,
        searchParams: searchParams,
      });

      const extractedRelatedPersons = bundle.entry
        ?.filter((entry) => entry.resource?.resourceType === 'RelatedPerson')
        .map((entry) => entry.resource as RelatedPerson);

      const extractedPatients = bundle.entry
        ?.filter((entry) => entry.resource?.resourceType === 'Patient')
        .map((entry) => entry.resource as Patient);

      return {
        patients: extractedPatients ?? null,
        relatedPersons: extractedRelatedPersons ?? null,
        total: bundle.total ?? 0,
      };
    },
    [fhirClient],
  );

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
    async function getPatients(): Promise<void> {
      if (
        (!submittedName && !submittedPhone) ||
        (submittedName && submittedName?.length < 3) ||
        (submittedPhone && submittedPhone?.length < 10)
      ) {
        return;
      }

      setLoading(true);

      const [lastName, firstName] = (submittedName?.toLowerCase() ?? '').split(',');

      if (submittedPhone) {
        // Search by phone first then narrow down results by name
        const digits = submittedPhone.replace(/\D/g, '');
        const searchParams: SearchParam[] = [
          { name: '_count', value: ENVIRONMENT === 'production' ? '25' : '500' }, // assuming the phone number holder doesn't have more than this number of family members
          { name: '_total', value: 'accurate' },
          {
            name: 'telecom',
            value: `${digits},+1${digits}`,
          },
          { name: '_include', value: 'RelatedPerson:patient' },
          { name: '_elements', value: 'patient,telecom' },
          { name: '_sort', value: 'telecom' },
        ];

        const {
          patients: extractedPatients,
          relatedPersons: extractedRelatedPersons,
          total,
        } = await getPatientsAndRelatedPersons('RelatedPerson', searchParams);
        setRelatedPersons(extractedRelatedPersons);

        let filteredPatients: Patient[] | null;
        if (submittedName) {
          if (lastName && firstName) {
            filteredPatients =
              extractedPatients?.filter(
                (patient) =>
                  patient.name?.[0].family?.toLowerCase().startsWith(lastName) &&
                  patient.name?.[0].given?.[0].toLowerCase().startsWith(firstName),
              ) ?? null;
          } else {
            filteredPatients =
              extractedPatients?.filter(
                (patient) =>
                  patient.name?.[0].family?.toLowerCase().includes(submittedName.toLowerCase()) ||
                  patient.name?.[0].given?.[0].toLowerCase().includes(submittedName.toLowerCase()),
              ) ?? null;
          }

          setPatients(filteredPatients?.slice(0, MAX_RESULTS) ?? null);

          // Assuming we've fetched all the related persons for this phone number holder,
          // we can set the new total to only the results that matched the name
          setTotalPatients(filteredPatients?.length ?? 0);
        } else {
          setPatients(extractedPatients?.slice(0, MAX_RESULTS) ?? null);
          setTotalPatients(total);
        }
      } else if (submittedName && !submittedPhone) {
        // Search by name only
        const searchParams: SearchParam[] = [
          { name: '_revinclude', value: 'RelatedPerson:patient' },
          { name: '_count', value: MAX_RESULTS.toString() },
          { name: '_total', value: 'accurate' },
          {
            name: '_sort',
            value: 'family',
          },
          { name: '_elements', value: 'id,name,birthDate' },
        ];

        if (lastName && firstName) {
          searchParams.push({ name: 'family', value: lastName.trim() }, { name: 'given', value: firstName.trim() });
        } else {
          searchParams.push({ name: 'name', value: submittedName });
        }

        const {
          patients: extractedPatients,
          relatedPersons: extractedRelatedPersons,
          total,
        } = await getPatientsAndRelatedPersons('Patient', searchParams);
        setRelatedPersons(extractedRelatedPersons);
        setPatients(extractedPatients);
        setTotalPatients(total);
      }

      setLoading(false);
    }

    getPatients().catch((error) => {
      console.log(error);
      setLoading(false);
    });
  }, [getPatientsAndRelatedPersons, submittedName, submittedPhone]);

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
