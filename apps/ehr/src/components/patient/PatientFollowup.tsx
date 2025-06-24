import { Box, CircularProgress, Grid, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { Encounter, Location } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatFhirEncounterToPatientFollowupDetails, getFullName, PatientFollowupDetails } from 'utils';
import { useApiClients } from '../../hooks/useAppClients';
import { useGetPatient } from '../../hooks/useGetPatient';
import PageContainer from '../../layout/PageContainer';
import CustomBreadcrumbs from '../CustomBreadcrumbs';
import { getFollowupStatusChip } from './PatientFollowupEncountersGrid';
import PatientFollowupForm from './PatientFollowupForm';

export default function PatientFollowup(): JSX.Element {
  const { id, encounterId } = useParams();
  const { patient } = useGetPatient(id);
  const { oystehr } = useApiClients();
  const [followupDetails, setFollowupDetails] = useState<PatientFollowupDetails | undefined>(undefined);
  const [followupStatus, setFollowupStatus] = useState<'OPEN' | 'RESOLVED' | undefined>(undefined);

  const fullName = patient ? getFullName(patient) : '';

  useEffect(() => {
    const getAndSetEncounterDetails = async (
      oystehr: Oystehr,
      encounterId: string,
      patientId: string
    ): Promise<void> => {
      const fhirResources = (
        await oystehr.fhir.search<Encounter | Location>({
          resourceType: 'Encounter',
          params: [
            {
              name: '_id',
              value: encounterId,
            },
            {
              name: '_include',
              value: 'Encounter:location',
            },
          ],
        })
      ).unbundle();

      const fhirEncounter = fhirResources.find((resource) => resource.resourceType === 'Encounter') as Encounter;
      const fhirLocation = fhirResources.find((resource) => resource.resourceType === 'Location') as Location;

      const formatted = formatFhirEncounterToPatientFollowupDetails(fhirEncounter, patientId, fhirLocation);
      setFollowupDetails(formatted);
      setFollowupStatus(formatted?.resolved ? 'RESOLVED' : 'OPEN');
    };
    if (encounterId && oystehr && patient?.id) {
      void getAndSetEncounterDetails(oystehr, encounterId, patient.id);
    }
  }, [encounterId, oystehr, patient?.id]);

  return (
    <PageContainer>
      <Grid container direction="row">
        <Grid item xs={3.5} />
        <Grid item xs={5}>
          {!followupStatus || !followupDetails || !patient ? (
            <Box sx={{ justifyContent: 'left' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <CustomBreadcrumbs
                chain={[
                  { link: '/patients', children: 'Patients' },
                  {
                    link: `/patient/${id}`,
                    children: fullName,
                  },
                  {
                    link: '#',
                    children: 'Patient Follow-up',
                  },
                ]}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 2,
                  marginBottom: 2,
                }}
              >
                <Typography variant="h3" marginTop={1} color={'primary.dark'}>
                  Patient Follow-up
                </Typography>
                {getFollowupStatusChip(followupStatus)}
              </Box>
              <PatientFollowupForm
                patient={patient}
                followupDetails={followupDetails}
                followupStatus={followupStatus}
                setFollowupStatus={setFollowupStatus}
              ></PatientFollowupForm>
            </>
          )}
        </Grid>
        <Grid item xs={3.5} />
      </Grid>
    </PageContainer>
  );
}
