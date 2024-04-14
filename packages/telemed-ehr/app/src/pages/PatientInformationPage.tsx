import {
  Box,
  Grid,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { Appointment, Location, Patient, RelatedPerson, Resource } from 'fhir/r4';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import PatientInformation from '../components/PatientInformation';
import { PriorityIconWithBorder } from '../components/PriorityIconWithBorder';
import {
  calculateDuration,
  formatDateUsingSlashes,
  formatISODateToLocaleDate,
  formatISOStringToDateAndTime,
} from '../helpers/formatDateTime';
import { standardizePhoneNumber } from '../helpers/formatPhoneNumber';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { VisitType, VisitTypeLabel } from '../types/types';

interface AppointmentWithLocation extends Appointment {
  location: string | undefined;
}

export default function PatientInformationPage(): JSX.Element {
  const { fhirClient } = useApiClients();

  const [patient, setPatient] = useState<Patient>();
  const [appointments, setAppointments] = useState<AppointmentWithLocation[]>();
  const [relatedPerson, setRelatedPerson] = useState<RelatedPerson>();
  const [loading, setLoading] = useState<boolean>(false);
  const theme = useTheme();

  const { id } = useParams();

  useEffect(() => {
    async function getPatient(): Promise<void> {
      const resourcesTemp = await fhirClient?.searchResources<Resource>({
        resourceType: 'Appointment',
        searchParams: [
          { name: 'patient', value: id ?? '' },
          {
            name: '_include',
            value: 'Appointment:patient',
          },
          {
            name: '_include',
            value: 'Appointment:location',
          },
          {
            name: '_revinclude:iterate',
            value: 'RelatedPerson:patient',
          },
          {
            name: '_sort',
            value: '-date',
          },
        ],
      });

      const patientTemp: Patient = resourcesTemp?.find((resource) => resource.resourceType === 'Patient') as Patient;
      const appointmentsTemp: Appointment[] = resourcesTemp?.filter(
        (resource) => resource.resourceType === 'Appointment',
      ) as Appointment[];
      const locations: Location[] = resourcesTemp?.filter(
        (resource) => resource.resourceType === 'Location',
      ) as Location[];
      const relatedPersonTemp: RelatedPerson = resourcesTemp?.find(
        (resource) => resource.resourceType === 'RelatedPerson',
      ) as RelatedPerson;

      const appointmentsFiltered: AppointmentWithLocation[] = appointmentsTemp?.map((appointment: Appointment) => {
        const appointmentLocationID = appointment.participant
          .find((participant) => participant.actor?.reference?.startsWith('Location/'))
          ?.actor?.reference?.replace('Location/', '');
        const location = locations.find((location) => location.id === appointmentLocationID);
        return {
          ...appointment,
          location:
            location?.address?.state &&
            location?.name &&
            `${location?.address?.state?.toUpperCase()} - ${location?.name}`,
        };
      });

      setAppointments(appointmentsFiltered);
      setPatient(patientTemp);
      setRelatedPerson(relatedPersonTemp);
    }
    setLoading(true);

    getPatient().catch((error) => {
      console.log(error);
    });
    setLoading(false);
  }, [fhirClient, id]);

  return (
    <PageContainer tabTitle={'Patient Information'}>
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item xs={9}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/patients', children: 'Patients' },
                {
                  link: '#',
                  children: `${patient?.name?.[0]?.family}, ${patient?.name?.[0]?.given?.[0]}` || (
                    <Skeleton width={150} />
                  ),
                },
              ]}
            />
            <Typography variant="h2" color="primary.dark">
              {`${patient?.name?.[0]?.family}, ${patient?.name?.[0]?.given?.[0]}`}
            </Typography>
            <Grid container direction="row" marginTop={1}>
              {loading ? (
                <Skeleton aria-busy="true" width={200} height="" />
              ) : (
                <>
                  <Typography variant="body1" sx={{ alignSelf: 'center', marginLeft: 1 }}>
                    Last visit:
                  </Typography>
                  <Typography sx={{ alignSelf: 'center', marginLeft: 1 }} fontWeight="bold">
                    Jan 16, 2024
                  </Typography>
                </>
              )}
              {/* appointment start time as AM/PM and then date */}
              {loading ? (
                <Skeleton sx={{ marginLeft: 2 }} aria-busy="true" width={200} />
              ) : (
                <>
                  <Typography variant="body1" sx={{ alignSelf: 'center', marginLeft: 1 }}>
                    Paperwork last updated:
                  </Typography>
                  <Typography sx={{ alignSelf: 'center', marginLeft: 1 }} fontWeight="bold">
                    {formatISODateToLocaleDate(patient?.meta?.lastUpdated ?? '')}
                  </Typography>
                </>
              )}
            </Grid>
            <Box>
              <PatientInformation
                title="Patient information"
                width="50%"
                loading={loading}
                patientDetails={{
                  'Date of birth': formatDateUsingSlashes(patient?.birthDate) || '-',
                  Phone:
                    standardizePhoneNumber(relatedPerson?.telecom?.find((obj) => obj?.system === 'phone')?.value) ||
                    '-',
                  Email: patient?.contact?.[0].telecom?.find((obj) => obj?.system === 'email')?.value || '-',
                }}
                icon={{
                  "Patient's date of birth (Unmatched)": <PriorityIconWithBorder fill={theme.palette.warning.main} />,
                }}
              />
            </Box>

            {/* Locations Search Box */}

            {appointments && (
              <Paper sx={{ padding: 2, marginTop: 5 }}>
                <Typography variant="h4" color="primary.dark">
                  Visits
                </Typography>
                <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }} align="left">
                        Visit ID
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="left">
                        Type
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="left">
                        Office
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="left">
                        Date & Time
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="left">
                        Length
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {appointments?.map((appointment, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Link to={`/visit/${appointment?.id}`}>{appointment?.id || '-'}</Link>
                        </TableCell>
                        <TableCell align="left">
                          {VisitTypeLabel[appointment?.appointmentType?.text as VisitType] || '-'}
                        </TableCell>
                        <TableCell align="left">{appointment?.location || '-'}</TableCell>
                        <TableCell align="left">
                          {formatISOStringToDateAndTime(appointment?.start ?? '') || '-'}
                        </TableCell>
                        <TableCell align="left">
                          {`${calculateDuration(appointment?.start ?? '', appointment?.end ?? '')} mins` || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}
