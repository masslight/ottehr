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
import { PatientInfoCard } from '../shadcn/components/PatientInfoCard';
import { ScrollToTop } from '../../../../ottehr-components';
import { BreadcrumbPatient } from '@/shadcn/components/Breadcrumbs';
import { TabsDemo } from '@/shadcn/components/Tabs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Callout } from '@/components/ui/callout';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Mic, MoreVertical, Save, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/shadcn/components/ChatInterface';
import { Card } from '@/components/ui/card';
import AppointmentHistory from '@/shadcn/components/Visits';
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
          resource.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.UC || tag.code === OTTEHR_MODULE.TM),
      ) as Appointment[];
      const locations: Location[] = resourcesTemp.filter(
        (resource) => resource.resourceType === 'Location',
      ) as Location[];
      const relatedPersonTemp: RelatedPerson = resourcesTemp.find(
        (resource) => resource.resourceType === 'RelatedPerson',
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

  // console.log('patient information appointments: ', appointments[0]);

  return (
    <>
      <ScrollToTop />
      <div className="m-8">
        <div className="flex gap-4 flex-col lg:flex-row">
          <PatientInfoCard patient={patient} loading={loading} lastAppointment={appointments?.[0]?.dateTime} />
          <div className="bg-gray-50 flex-1 py-4 space-y-4">
            <BreadcrumbPatient
              loading={loading}
              currentPage={`${patient?.name?.[0]?.family}, ${patient?.name?.[0]?.given?.[0]}`}
            />
            <Card className="px-4 bg-white">
              <Tabs defaultValue="visits" className="w-full my-4">
                <TabsList className="w-full">
                  <TabsTrigger value="visits" className="flex justify-center text-center">
                    Visits
                  </TabsTrigger>
                  <TabsTrigger value="Notes" className="flex justify-center text-center">
                    Notes
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="visits">
                  <AppointmentHistory appointments={appointments} />
                </TabsContent>
                <TabsContent value="Notes" className="">
                  <div>{/* <ChatInterface isOpen={true} onClose={() => {}} recipientName="Dr. Smith" /> */}</div>
                  <div className="flex">
                    <div className="my-8">
                      <Textarea placeholder="Write a note here..." />
                      <div className="flex items-center gap-2 mt-4">
                        <Button className="bg-teal-500 hover:bg-teal-600">
                          <Mic className="w-4 h-4 mr-2" />
                          Start Recording
                        </Button>
                        <Button variant="outline" className="bg-white">
                          <Square className="w-4 h-4 mr-2" />
                          Stop
                        </Button>
                        <Button variant="outline" className="bg-white">
                          <Save className="w-4 h-4 mr-2" />
                          Save Note
                        </Button>
                      </div>
                      <div className="mt-4 p-4 bg-gray-100 rounded-md min-h-[100px] text-gray-500">
                        Transcription will appear here...
                      </div>
                    </div>
                    <div>
                      <div className="ml-8 space-y-4">
                        <h3 className="font-semibold text-lg">Previous Notes</h3>
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-lg border">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">Dr. Smith</p>
                                <p className="text-sm text-gray-500">March 15, 2024 at 2:30 PM</p>
                              </div>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="mt-2 text-gray-700">
                              Patient reports improved symptoms after medication adjustment. Blood pressure 120/80.
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg border">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">Dr. Johnson</p>
                                <p className="text-sm text-gray-500">March 1, 2024 at 10:15 AM</p>
                              </div>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="mt-2 text-gray-700">
                              Initial consultation. Patient presents with mild hypertension. Prescribed medication and
                              lifestyle changes.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div></div>
                      <div className="fixed bottom-4 right-4">
                        <Button className="bg-teal-500 hover:bg-teal-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                          <MessageSquare className="h-6 w-6" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
        <OttehrPatientInformationPage
          patient={patient}
          loading={loading}
          appointments={appointments}
          otherPatientsWithSameName={otherPatientsWithSameName}
        />
      </div>
    </>
  );
}

const OttehrPatientInformationPage = ({
  patient,
  loading,
  appointments,
  relatedPerson,
  otherPatientsWithSameName,
  setOtherPatientsWithSameName,
}: {
  patient: Patient;
  loading: boolean;
  relatedPerson: RelatedPerson;
  appointments: Appointment[];
  otherPatientsWithSameName: boolean;
  setOtherPatientsWithSameName: (value: boolean) => void;
}) => {
  const theme = useTheme();

  return (
    <div className="py-24">
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item xs={9}>
          <h1 className="text-4xl font-bold my-8">Otther Patient Information</h1>
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
                There are other patients with this name in our database. Please check the patient&apos;s DOB to confirm
                you are viewing the right patient.
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
                  standardizePhoneNumber(relatedPerson?.telecom?.find((obj) => obj?.system === 'phone')?.value) || '-',
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
                <div>Visits</div>
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
    </div>
  );
};
