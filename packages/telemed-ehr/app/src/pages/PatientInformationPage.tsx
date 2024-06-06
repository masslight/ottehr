import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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
import { SearchParam } from '@zapehr/sdk';
import { OTTEHR_MODULE, getVisitStatusHistory } from 'ehr-utils';
import { Appointment, Location, Patient, RelatedPerson, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFirstName, getLastName } from 'ehr-utils';
import { otherColors } from '../CustomThemeProvider';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import PatientInformation from '../components/PatientInformation';
import { PriorityIconWithBorder } from '../components/PriorityIconWithBorder';
import {
  formatDateUsingSlashes,
  formatISODateToLocaleDate,
  formatISOStringToDateAndTime,
} from '../helpers/formatDateTime';
import { standardizePhoneNumber } from 'ehr-utils';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { formatMinutes, getVisitTotalTime } from '../helpers/visitDurationUtils';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { getVisitTypeLabelForAppointment } from '../types/types';

interface AppointmentRow {
  id: string | undefined;
  type: string | undefined;
  office: string | undefined;
  dateTime: string | undefined;
  length: number;
}

export default function PatientInformationPage(): JSX.Element {
  const { fhirClient } = useApiClients();

  const [patient, setPatient] = useState<Patient>();
  const [appointments, setAppointments] = useState<AppointmentRow[]>();
  const [relatedPerson, setRelatedPerson] = useState<RelatedPerson>();
  const [loading, setLoading] = useState<boolean>(true);
  const [otherPatientsWithSameName, setOtherPatientsWithSameName] = useState<boolean>(false);
  const theme = useTheme();

  const { id } = useParams();

  useEffect(() => {
    async function getPatient(): Promise<void> {
      if (!fhirClient || !id) {
        throw new Error('fhirClient or patient ID is not defined');
      }

      setLoading(true);
      const resourcesTemp = await fhirClient.searchResources<Resource>({
        resourceType: 'Patient',
        searchParams: [
          { name: '_id', value: id },
          {
            name: '_revinclude',
            value: 'Appointment:patient',
          },
          {
            name: '_include:iterate',
            value: 'Appointment:location',
          },
          {
            name: '_revinclude:iterate',
            value: 'RelatedPerson:patient',
          },
        ],
      });

      const patientTemp: Patient = resourcesTemp.find((resource) => resource.resourceType === 'Patient') as Patient;
      const appointmentsTemp: Appointment[] = resourcesTemp.filter(
        (resource) =>
          resource.resourceType === 'Appointment' &&
          resource.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.UC || tag.code === OTTEHR_MODULE.TM)
      ) as Appointment[];
      const locations: Location[] = resourcesTemp.filter(
        (resource) => resource.resourceType === 'Location'
      ) as Location[];
      const relatedPersonTemp: RelatedPerson = resourcesTemp.find(
        (resource) => resource.resourceType === 'RelatedPerson'
      ) as RelatedPerson;

      appointmentsTemp.sort((a, b) => {
        const createdA = DateTime.fromISO(a.start ?? '');
        const createdB = DateTime.fromISO(b.start ?? '');
        return createdB.diff(createdA).milliseconds;
      });

      const first = getFirstName(patientTemp);
      const last = getLastName(patientTemp);
      const otherPatientParams: SearchParam[] = getPatientNameSearchParams({
        firstLast: { first, last },
        narrowByRelatedPersonAndAppointment: false,
        maxResultOverride: 2,
      });
      const otherPatientsWithSameNameTemp = await fhirClient.searchResources<Resource>({
        resourceType: 'Patient',
        searchParams: otherPatientParams,
      });

      if (otherPatientsWithSameNameTemp?.length > 1) {
        setOtherPatientsWithSameName(true);
      } else {
        setOtherPatientsWithSameName(false);
      }

      const appointmentRows: AppointmentRow[] = appointmentsTemp.map((appointment: Appointment) => {
        const appointmentLocationID = appointment.participant
          .find((participant) => participant.actor?.reference?.startsWith('Location/'))
          ?.actor?.reference?.replace('Location/', '');
        const location = locations.find((location) => location.id === appointmentLocationID);

        return {
          id: appointment.id,
          type: getVisitTypeLabelForAppointment(appointment),
          office:
            location?.address?.state &&
            location?.name &&
            `${location?.address?.state?.toUpperCase()} - ${location?.name}`,
          dateTime: appointment.start,
          length: getVisitTotalTime(appointment, getVisitStatusHistory(appointment), DateTime.now()),
        };
      });

      setAppointments(appointmentRows);
      setPatient(patientTemp);
      setRelatedPerson(relatedPersonTemp);
    }

    getPatient()
      .catch((error) => console.log(error))
      .finally(() => setLoading(false));
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
                  children: loading ? (
                    <Skeleton width={150} />
                  ) : (
                    `${patient?.name?.[0]?.family}, ${patient?.name?.[0]?.given?.[0]}`
                  ),
                },
              ]}
            />
            <Typography variant="h2" color="primary.dark">
              {loading ? (
                <Skeleton aria-busy="true" width={200} height="" />
              ) : (
                `${patient?.name?.[0]?.family}, ${patient?.name?.[0]?.given?.[0]}`
              )}
              {}
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
                    {formatISODateToLocaleDate(appointments?.find((appointment) => appointment.length > 0)?.dateTime) ||
                      'N/A'}
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
            {otherPatientsWithSameName && (
              <Box
                sx={{
                  marginTop: 1,
                  padding: 1,
                  background: otherColors.dialogNote,
                  borderRadius: '4px',
                }}
                display="flex"
              >
                <WarningAmberIcon sx={{ marginTop: 1, color: otherColors.warningIcon }} />
                <Typography
                  variant="body2"
                  color={otherColors.closeCross}
                  sx={{ m: 1.25, maxWidth: 850, fontWeight: 700 }}
                >
                  There are other patients with this name in our database. Please check the patient's DOB to confirm you
                  are viewing the right patient.
                </Typography>
                <CloseIcon
                  onClick={() => setOtherPatientsWithSameName(false)}
                  sx={{ marginLeft: 'auto', marginRight: 0, marginTop: 1, color: otherColors.closeCross }}
                />
              </Box>
            )}

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
                          <Link to={`/visit/${appointment.id}`}>{appointment.id || '-'}</Link>
                        </TableCell>
                        <TableCell align="left">{appointment.type || '-'}</TableCell>
                        <TableCell align="left">{appointment.office || '-'}</TableCell>
                        <TableCell align="left">
                          {appointment.dateTime ? formatISOStringToDateAndTime(appointment.dateTime) : '-'}
                        </TableCell>
                        <TableCell align="left">
                          {appointment.length !== undefined
                            ? `${formatMinutes(appointment.length)} ${appointment.length === 1 ? 'min' : 'mins'}`
                            : '-'}
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
