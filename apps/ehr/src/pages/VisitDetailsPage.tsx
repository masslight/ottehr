import { otherColors } from '@ehrTheme/colors';
import CircleIcon from '@mui/icons-material/Circle';
import ContentPasteOffIcon from '@mui/icons-material/ContentPasteOff';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Alert, { AlertColor } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Appointment, Flag, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  generatePaperworkPdf,
  getPatientVisitDetails,
  getPatientVisitFiles,
  updatePatientVisitDetails,
} from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { TelemedAppointmentStatusChip } from 'src/components/TelemedAppointmentStatusChip';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import {
  BOOKING_CONFIG,
  DocumentType,
  EHRVisitDetails,
  FHIR_EXTENSION,
  FhirAppointmentType,
  getFirstName,
  getFullName,
  getInPersonVisitStatus,
  getLastName,
  getMiddleName,
  getPatchOperationForNewMetaTag,
  isApiError,
  isEncounterSelfPay,
  isInPersonAppointment,
  mapStatusToTelemed,
  TelemedAppointmentStatus,
  UpdateVisitDetailsInput,
  VisitDocuments,
  VisitStatusLabel,
} from 'utils';
import AppointmentNotesHistory from '../components/AppointmentNotesHistory';
import CardGridItem from '../components/CardGridItem';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import DateSearch from '../components/DateSearch';
import {
  ActivityLogDialog,
  CancellationReasonDialog,
  CustomDialog,
  EditPatientInfoDialog,
  ReportIssueDialog,
} from '../components/dialogs';
import ImageCarousel, { ImageCarouselObject } from '../components/ImageCarousel';
import { InPersonAppointmentStatusChip } from '../components/InPersonAppointmentStatusChip';
import PaperworkFlagIndicator from '../components/PaperworkFlagIndicator';
import PatientInformation, { IconProps } from '../components/PatientInformation';
import PatientPaymentList from '../components/PatientPaymentsList';
import { PriorityIconWithBorder } from '../components/PriorityIconWithBorder';
import { HOP_QUEUE_URI } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { ChangeStatusDropdown } from '../features/visits/in-person/components/ChangeStatusDropdown';
import { PencilIconButton } from '../features/visits/telemed/components/patient-visit-details/PencilIconButton';
import { formatLastModifiedTag } from '../helpers';
import {
  ActivityLogData,
  ActivityName,
  formatActivityLogs,
  formatNotesHistory,
  getAppointmentAndPatientHistory,
  getCriticalUpdateTagOp,
  NoteHistory,
} from '../helpers/activityLogsUtils';
import { formatDateUsingSlashes } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser from '../hooks/useEvolveUser';
import PageContainer from '../layout/PageContainer';
import { appointmentTypeLabels, fhirAppointmentTypeToVisitType, visitTypeToTelemedLabel } from '../types/types';
import { PatientAccountComponent } from './PatientInformationPage';

const consentToTreatPatientDetailsKey = 'Consent Forms signed?';

interface EditNameParams {
  first?: string;
  middle?: string;
  last?: string;
  suffix?: string;
}

interface EditDOBParams {
  dob?: DateTime | null;
}

interface EditReasonForVisitParams {
  reasonForVisit?: string;
}
interface EditNLGParams {
  guardians?: string;
}

type EditDialogConfig =
  | {
      type: 'closed';
      values: object;
      keyTitleMap: object;
    }
  | {
      type: 'name';
      values: EditNameParams;
      keyTitleMap: {
        first: 'First';
        middle: 'Middle';
        last: 'Last';
        suffix: 'Suffix';
      };
    }
  | { type: 'dob'; values: EditDOBParams; keyTitleMap: { dob: 'DOB' } }
  | { type: 'reason-for-visit'; values: EditReasonForVisitParams; keyTitleMap: { reasonForVisit: 'Reason for Visit' } }
  | { type: 'nlg'; values: EditNLGParams; keyTitleMap: { guardians: 'Guardians' } };

const dialogTitleFromType = (type: EditDialogConfig['type']): string => {
  switch (type) {
    case 'name':
      return "Please enter patient's name";
    case 'dob':
      return "Please enter patient's confirmed date of birth";
    case 'reason-for-visit':
      return "Please enter patient's reason for visit";
    case 'nlg':
      return "Please enter patient's Authorized Non-Legal Guardians";
    default:
      return '';
  }
};

const CLOSED_EDIT_DIALOG: EditDialogConfig = Object.freeze({ type: 'closed', values: {}, keyTitleMap: {} });

export default function VisitDetailsPage(): ReactElement {
  // variables
  const { id: appointmentID } = useParams();
  const { oystehr, oystehrZambda } = useApiClients();
  const theme = useTheme();

  // state variables
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [appointment, setAppointment] = useState<Appointment | undefined>(undefined);
  const [paperworkModifiedFlag, setPaperworkModifiedFlag] = useState<Flag | undefined>(undefined);
  const [status, setStatus] = useState<VisitStatusLabel | TelemedAppointmentStatus | undefined>(undefined);
  const [errors, setErrors] = useState<{ editName?: boolean; editDOB?: boolean; hopError?: string }>({
    editName: false,
    editDOB: false,
  });
  const [toastMessage, setToastMessage] = React.useState<string | undefined>(undefined);
  const [toastType, setToastType] = React.useState<AlertColor | undefined>(undefined);
  const [snackbarOpen, setSnackbarOpen] = React.useState<boolean>(false);
  const [paperworkPdfLoading, setPaperworkPdfLoading] = React.useState<boolean>(false);

  const [editDialogConfig, setEditDialogConfig] = useState<EditDialogConfig>(CLOSED_EDIT_DIALOG);

  // File variables

  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);
  const [hopQueueDialogOpen, setHopQueueDialogOpen] = useState<boolean>(false);
  const [hopLoading, setHopLoading] = useState<boolean>(false);
  const [photoZoom, setPhotoZoom] = useState<boolean>(false);
  const [zoomedIdx, setZoomedIdx] = useState<number>(0);
  const [issueDialogOpen, setIssueDialogOpen] = useState<boolean>(false);
  const [activityLogDialogOpen, setActivityLogDialogOpen] = useState<boolean>(false);
  const [activityLogsLoading, setActivityLogsLoading] = useState<boolean>(true);
  const [activityLogs, setActivityLogs] = useState<ActivityLogData[] | undefined>(undefined);
  const [notesHistory, setNotesHistory] = useState<NoteHistory[] | undefined>(undefined);
  const user = useEvolveUser();

  const { isLoadingDocuments, downloadDocument } = useGetPatientDocs(patient?.id ?? '');

  const { data: imageFileData, isLoading: imagesLoading } = useQuery({
    queryKey: ['get-visit-files', appointmentID],

    queryFn: async (): Promise<VisitDocuments> => {
      if (oystehrZambda && appointmentID) {
        return getPatientVisitFiles(oystehrZambda, { appointmentId: appointmentID });
      }
      throw new Error('fhir client not defined or patientIds not provided');
    },

    enabled: Boolean(oystehrZambda) && appointmentID !== undefined,
  });
  const { photoIdCards, insuranceCards, insuranceCardsSecondary, fullCardPdfs, consentPdfUrls } = imageFileData || {
    photoIdCards: [],
    insuranceCards: [],
    insuranceCardsSecondary: [],
    fullCardPdfs: [],
    consentPdfUrls: [],
  };

  const {
    data: visitDetailsData,
    isLoading: loading,
    refetch: refetchVisitDetails,
    isRefetching: visitDetailsAreRefreshing,
    error: visitDetailsError,
  } = useQuery({
    queryKey: ['get-visit-details', appointmentID],

    queryFn: async (): Promise<EHRVisitDetails> => {
      if (oystehrZambda && appointmentID) {
        return getPatientVisitDetails(oystehrZambda, { appointmentId: appointmentID }).then((details) => {
          setAppointment(details.appointment);
          setPatient(details.patient);
          setPaperworkModifiedFlag(
            details.flags.find(
              (resource: Flag) =>
                resource.status === 'active' && resource?.meta?.tag?.find((tag) => tag.code === 'paperwork-edit')
            ) as Flag | undefined
          );
          return details;
        });
      }
      throw new Error('fhir client not defined or appointmentId not provided');
    },
    enabled: Boolean(oystehrZambda) && appointmentID !== undefined,
  });

  const encounter = visitDetailsData?.encounter;
  const qrId = visitDetailsData?.qrId;

  const { fullName, patientFirstName, patientMiddleName, patientLastName } = useMemo(() => {
    let fullName = '';
    let patientFirstName: string | undefined;
    let patientMiddleName: string | undefined;
    let patientLastName: string | undefined;

    if (patient) {
      fullName = getFullName(patient);
      patientFirstName = getFirstName(patient);
      patientMiddleName = getMiddleName(patient);
      patientLastName = getLastName(patient);
    }
    return {
      fullName,
      patientFirstName,
      patientMiddleName,
      patientLastName,
    };
  }, [patient]);

  const selfPay = isEncounterSelfPay(visitDetailsData?.encounter);
  const isInPerson = isInPersonAppointment(appointment);

  const bookingDetailsMutation = useMutation({
    mutationFn: async (input: UpdateVisitDetailsInput) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      await updatePatientVisitDetails(oystehrZambda, input);
    },
    onSuccess: async () => {
      await refetchVisitDetails();
      if (editDialogConfig.type === 'name') {
        await getAndSetHistoricResources({ logs: true }).catch((error) => {
          console.log('error getting activity logs after name update', error);
        });
      }
      setEditDialogConfig(CLOSED_EDIT_DIALOG);
      enqueueSnackbar('Patient information updated successfully', {
        variant: 'success',
      });
    },
  });

  const handleUpdateBookingDetails = async (): Promise<void> => {
    if (!appointmentID || !editDialogConfig.values || editDialogConfig.type === 'closed') {
      return;
    }
    let bookingDetails: UpdateVisitDetailsInput['bookingDetails'];
    if (editDialogConfig.type === 'dob') {
      bookingDetails = {
        confirmedDob: editDialogConfig.values.dob?.toISODate() ?? undefined,
      };
    } else if (editDialogConfig.type === 'name') {
      bookingDetails = {
        patientName: {
          ...editDialogConfig.values,
        },
      };
    } else if (editDialogConfig.type === 'nlg') {
      bookingDetails = {
        authorizedNonLegalGuardians: editDialogConfig.values.guardians,
      };
    } else {
      // type === reason-for-visit
      bookingDetails = {
        ...editDialogConfig.values,
      };
    }
    await bookingDetailsMutation.mutateAsync({
      appointmentId: appointmentID,
      bookingDetails,
    });
  };

  async function dismissPaperworkModifiedFlag(): Promise<void> {
    if (!oystehr) {
      throw new Error('Oystehr client not found.');
    }
    await oystehr.fhir.patch({
      resourceType: 'Flag',
      id: paperworkModifiedFlag?.id || '',
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'inactive',
        },
      ],
    });
    setPaperworkModifiedFlag(undefined);
  }

  const hopInQueue = async (): Promise<void> => {
    setHopLoading(true);
    const now = DateTime.now().toISO();
    if (appointment?.id && now) {
      const operation = getPatchOperationForNewMetaTag(appointment, {
        system: HOP_QUEUE_URI,
        code: now,
      });
      const updateTag = getCriticalUpdateTagOp(appointment, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
      try {
        const updatedAppt = await oystehr?.fhir.patch<Appointment>({
          resourceType: 'Appointment',
          id: appointment.id,
          operations: [operation, updateTag],
        });
        setAppointment(updatedAppt);
        const errorsCopy = errors;
        delete errorsCopy.hopError;
        setErrors(errorsCopy);
        setHopQueueDialogOpen(false);
      } catch (e) {
        console.log('error hopping queue', e);
        setErrors({ ...errors, hopError: 'There was an error moving this appointment to next' });
      }
      setHopLoading(false);
    }
  };

  useEffect(() => {
    if (visitDetailsError) {
      if (isApiError(visitDetailsError)) {
        enqueueSnackbar(visitDetailsError.message, {
          variant: 'error',
        });
      } else {
        console.error('Error fetching visit details:', visitDetailsError);
        enqueueSnackbar('An unexpected error occurred while fetching visit details.', {
          variant: 'error',
        });
      }
    }
  }, [visitDetailsError]);

  // variables for displaying the page
  const appointmentType = (appointment?.appointmentType?.text as FhirAppointmentType) || '';
  const locationTimeZone = visitDetailsData?.visitTimezone || '';
  const appointmentStartTime = DateTime.fromISO(appointment?.start ?? '').setZone(locationTimeZone);
  const appointmentTime = appointmentStartTime.toLocaleString(DateTime.TIME_SIMPLE);
  const appointmentDate = formatDateUsingSlashes(appointmentStartTime.toISO() || '', locationTimeZone);
  const nameLastModifiedOld = formatLastModifiedTag('name', patient, locationTimeZone);
  const dobLastModifiedOld = formatLastModifiedTag('dob', patient, locationTimeZone);

  const unconfirmedDOB = DateTime.fromFormat('11/11/2011', 'MM/dd/yyyy').toISO(); //appointment && getUnconfirmedDOBForAppointment(appointment);
  const getAppointmentType = (appointmentType: FhirAppointmentType | undefined): string => {
    if (!appointmentType) {
      return '';
    }

    if (isInPerson) {
      return appointmentTypeLabels[appointmentType] || '';
    } else {
      return visitTypeToTelemedLabel[fhirAppointmentTypeToVisitType[appointmentType]] || '';
    }
  };

  const { nameLastModified, dobLastModified } = useMemo(() => {
    let nameLastModified: string | undefined;
    let dobLastModified: string | undefined;
    if (activityLogs) {
      const nameChangelog = activityLogs.find((log) => log.activityName === ActivityName.nameChange);
      if (nameChangelog) nameLastModified = `${nameChangelog.activityDateTime} by ${nameChangelog.activityBy}`;
      const dobChangeLog = activityLogs.find((log) => log.activityName === ActivityName.dobChange);
      if (dobChangeLog) dobLastModified = `${dobChangeLog.activityDateTime} by ${dobChangeLog.activityBy}`;
    }
    return { nameLastModified, dobLastModified };
  }, [activityLogs]);

  const getAndSetHistoricResources = useCallback(
    async ({ logs, notes }: { logs?: boolean; notes?: boolean }) => {
      if (appointment) {
        const history = await getAppointmentAndPatientHistory(appointment, oystehr);
        if (history) {
          if (logs) {
            const activityLogs = formatActivityLogs(
              appointment,
              history.appointmentHistory,
              history.patientHistory,
              undefined,
              locationTimeZone
            );
            setActivityLogs(activityLogs);
          }
          if (notes) {
            const formattedNotes = formatNotesHistory(locationTimeZone, history.appointmentHistory);
            setNotesHistory(formattedNotes);
          }
        }
        setActivityLogsLoading(false);
      }
    },
    [appointment, oystehr, locationTimeZone]
  );

  useEffect(() => {
    if (!activityLogs && appointment && locationTimeZone && oystehr) {
      getAndSetHistoricResources({ logs: true, notes: true }).catch((error) => {
        console.log('error getting activity logs', error);
        setActivityLogsLoading(false);
      });
    }
  }, [activityLogs, setActivityLogs, appointment, locationTimeZone, oystehr, getAndSetHistoricResources]);

  useEffect(() => {
    if (appointment && encounter) {
      const encounterStatus = isInPerson
        ? getInPersonVisitStatus(appointment, encounter)
        : mapStatusToTelemed(encounter.status, appointment.status);

      setStatus(encounterStatus);
    } else {
      setStatus(undefined);
    }
  }, [appointment, encounter, isInPerson]);

  // page HTML
  const handleCancelDialogOpen = (): void => {
    setCancelDialogOpen(true);
  };

  const handleCancelDialogClose = (): void => {
    setCancelDialogOpen(false);
  };

  function pdfButton(pdfUrls: string[]): ReactElement {
    const handleClick = (): void => {
      pdfUrls.forEach((url) => {
        window.open(url, '_blank');
      });
    };
    return (
      <RoundedButton
        variant="outlined"
        onClick={handleClick}
        disabled={imagesLoading}
        sx={{
          borderColor: otherColors.consentBorder,
          borderRadius: 100,
          textTransform: 'none',
          fontWeight: 500,
          fontSize: 14,
        }}
      >
        Get PDFs
      </RoundedButton>
    );
  }

  const consentEditProp = (): IconProps => {
    const ret: IconProps = {};

    if (consentPdfUrls) {
      ret[consentToTreatPatientDetailsKey] = pdfButton(consentPdfUrls);
    }

    return ret;
  };

  const signedConsentForm: {
    [consentToTreatPatientDetailsKey]?: 'Signed' | 'Not signed' | 'Loading...';
  } = loading
    ? { [consentToTreatPatientDetailsKey]: 'Loading...' }
    : (() => {
        const consentDetails = visitDetailsData?.consentDetails;
        if (consentDetails) {
          return {
            [consentToTreatPatientDetailsKey]: 'Signed',
            Signature: consentDetails.signature,
            'Full name': consentDetails.fullName,
            'Relationship to patient': consentDetails.relationshipToPatient,
            Date: consentDetails.date,
            IP: consentDetails.ipAddress,
          };
        } else {
          return { [consentToTreatPatientDetailsKey]: 'Not signed' };
        }
      })();

  if (consentPdfUrls.length > 0) {
    signedConsentForm[consentToTreatPatientDetailsKey] = imagesLoading ? 'Loading...' : 'Signed';
  } else {
    signedConsentForm[consentToTreatPatientDetailsKey] = imagesLoading ? 'Loading...' : 'Not signed';
  }

  // const suffixOptions = ['II', 'III', 'IV', 'Jr', 'Sr'];

  const imageCarouselObjs = useMemo(
    () => [
      ...insuranceCards.map<ImageCarouselObject>((card) => ({ alt: card.type, url: card.presignedUrl || '' })),
      ...insuranceCardsSecondary.map<ImageCarouselObject>((card) => ({ alt: card.type, url: card.presignedUrl || '' })),
      ...photoIdCards.map<ImageCarouselObject>((card) => ({ alt: card.type, url: card.presignedUrl || '' })),
    ],
    [insuranceCards, insuranceCardsSecondary, photoIdCards]
  );

  const reasonForVisit = useMemo(() => {
    const complaints = (appointment?.description ?? '').split(',');
    return complaints.map((complaint) => complaint.trim()).join(', ');
  }, [appointment?.description]);

  const authorizedGuardians =
    patient?.extension?.find((e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url)?.valueString ??
    'none';

  const downloadPaperworkPdf = async (): Promise<void> => {
    setPaperworkPdfLoading(true);
    try {
      const response = await generatePaperworkPdf(oystehrZambda!, {
        questionnaireResponseId: qrId!,
      });
      await downloadDocument(response.documentReference.split('/')[1]);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to generate PDF.', { variant: 'error' });
    } finally {
      setPaperworkPdfLoading(false);
    }
  };

  return (
    <PageContainer>
      <>
        {/* Card image zoom dialog */}
        <ImageCarousel
          imagesObj={imageCarouselObjs}
          imageIndex={zoomedIdx}
          setImageIndex={setZoomedIdx}
          open={photoZoom}
          setOpen={setPhotoZoom}
        />

        {/* page */}
        <Grid container direction="row">
          <Grid item xs={0.25}></Grid>
          <Grid item xs={11.5}>
            <Grid container direction="row">
              <Grid item xs={6}>
                <CustomBreadcrumbs
                  chain={[
                    { link: `/patient/${patient?.id}`, children: 'Visit Details' },
                    { link: '#', children: appointment?.id || <Skeleton width={150} /> },
                  ]}
                />
              </Grid>
              <Grid item container xs={6} justifyContent="flex-end">
                <LoadingButton
                  variant="outlined"
                  sx={{
                    borderRadius: '20px',
                    textTransform: 'none',
                  }}
                  loading={paperworkPdfLoading}
                  color="primary"
                  disabled={isLoadingDocuments || !patient?.id}
                  onClick={downloadPaperworkPdf}
                >
                  Paperwork PDF
                </LoadingButton>
              </Grid>
            </Grid>
            {/* page title row */}
            <Grid container direction="row" marginTop={1}>
              {loading || activityLogsLoading || !patient ? (
                <Skeleton aria-busy="true" width={200} height="" />
              ) : (
                <>
                  <PencilIconButton
                    onClick={() =>
                      setEditDialogConfig({
                        type: 'name',
                        values: {
                          first: patientFirstName,
                          middle: patientMiddleName,
                          last: patientLastName,
                        },
                        keyTitleMap: { first: 'First', middle: 'Middle', last: 'Last', suffix: 'Suffix' },
                      })
                    }
                    size="25px"
                    sx={{ mr: '7px', padding: 0, alignSelf: 'center' }}
                  />
                  <Typography
                    variant="h2"
                    color="primary.dark"
                    data-testid={dataTestIds.appointmentPage.patientFullName}
                  >
                    {fullName}
                  </Typography>
                </>
              )}

              <CircleIcon
                sx={{ color: 'primary.main', width: '10px', height: '10px', marginLeft: 2, alignSelf: 'center' }}
              />
              {/* appointment start time as AM/PM and then date */}
              {loading || !appointment ? (
                <Skeleton sx={{ marginLeft: 2 }} aria-busy="true" width={200} />
              ) : (
                <>
                  <Typography variant="body1" sx={{ alignSelf: 'center', marginLeft: 1 }}>
                    {getAppointmentType(appointmentType ?? '')}
                  </Typography>
                  <Typography sx={{ alignSelf: 'center', marginLeft: 1 }} fontWeight="bold">
                    {appointmentTime}
                  </Typography>
                  <Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>{appointmentDate}</Typography>
                </>
              )}

              {loading || !status ? (
                <Skeleton sx={{ marginLeft: 2 }} aria-busy="true" width={200} />
              ) : (
                <>
                  <Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>
                    {visitDetailsData?.visitLocationName ?? ''}
                  </Typography>
                  <span
                    style={{
                      marginLeft: 20,
                      alignSelf: 'center',
                    }}
                  >
                    {isInPerson ? (
                      <InPersonAppointmentStatusChip status={status as VisitStatusLabel} />
                    ) : (
                      <TelemedAppointmentStatusChip status={status as TelemedAppointmentStatus} />
                    )}
                  </span>
                  {appointment && appointment.status === 'cancelled' && (
                    <Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>
                      {appointment?.cancelationReason?.coding?.[0]?.display}
                    </Typography>
                  )}
                </>
              )}
              {appointment && encounter && appointment?.status !== 'cancelled' ? (
                <>
                  <Button
                    data-testid={dataTestIds.visitDetailsPage.cancelVisitButton}
                    variant="outlined"
                    sx={{
                      alignSelf: 'center',
                      marginLeft: 'auto',
                      // marginRight: 2,
                      borderRadius: '20px',
                      textTransform: 'none',
                    }}
                    color="error"
                    onClick={handleCancelDialogOpen}
                  >
                    Cancel visit
                  </Button>
                  <CancellationReasonDialog
                    handleClose={handleCancelDialogClose}
                    refetchData={async () => {
                      refetchVisitDetails().catch((error) => console.log('error refetching visit details', error));
                    }}
                    appointment={appointment}
                    encounter={encounter}
                    open={cancelDialogOpen}
                    getAndSetResources={getAndSetHistoricResources}
                  />
                </>
              ) : null}
              {status === 'arrived' ? (
                <>
                  <Button
                    variant="outlined"
                    sx={{
                      alignSelf: 'center',
                      marginLeft: 1,
                      borderRadius: '20px',
                      textTransform: 'none',
                    }}
                    disabled={!!appointment?.meta?.tag?.find((tag) => tag.system === 'hop-queue')?.code}
                    onClick={() => setHopQueueDialogOpen(true)}
                  >
                    Move to next
                  </Button>
                  <CustomDialog
                    open={hopQueueDialogOpen}
                    handleClose={() => {
                      const errorsCopy = errors;
                      delete errorsCopy.hopError;
                      setErrors(errorsCopy);
                      setHopQueueDialogOpen(false);
                    }}
                    closeButton={false}
                    title="Move to next"
                    description={`Are you sure you want to move ${patient?.name?.[0]?.family}, ${patient?.name?.[0]?.given?.[0]} to next?`}
                    closeButtonText="Cancel"
                    handleConfirm={async () => await hopInQueue()}
                    confirmText="Move to next"
                    confirmLoading={hopLoading}
                    error={errors?.hopError}
                  />
                </>
              ) : null}
            </Grid>

            {(nameLastModifiedOld || nameLastModified) && (
              <Grid container direction="row">
                <Typography sx={{ alignSelf: 'center', marginLeft: 4, fontSize: '14px' }}>
                  Name Last Modified {nameLastModifiedOld || nameLastModified}
                </Typography>
              </Grid>
            )}

            {paperworkModifiedFlag && (
              <Grid container direction="row" marginTop={2}>
                <PaperworkFlagIndicator
                  title="Paperwork was updated:"
                  dateTime={paperworkModifiedFlag.period?.start}
                  timezone={locationTimeZone}
                  onDismiss={dismissPaperworkModifiedFlag}
                  color={otherColors.warningText}
                  backgroundColor={otherColors.warningBackground}
                  icon={<WarningAmberIcon sx={{ color: otherColors.warningIcon }} />}
                />
              </Grid>
            )}

            {/* new insurance card and photo id */}
            <Grid container direction="row" marginTop={2}>
              <Paper sx={{ width: '100%' }}>
                <Box padding={3}>
                  {imagesLoading ? (
                    <Grid container direction="row" maxHeight="210px" height="210px" spacing={2}>
                      <Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
                        <CircularProgress sx={{ justifySelf: 'center' }} />
                      </Grid>
                    </Grid>
                  ) : (
                    <Grid
                      container
                      direction="row"
                      rowGap={2}
                      columnSpacing={2}
                      sx={{ display: 'flex' }}
                      minHeight="210px"
                    >
                      <>
                        {!selfPay && insuranceCards.length > 0 && (
                          <Grid item xs={12} sm={6}>
                            <Grid item>
                              <Typography color="primary.dark" variant="body2">
                                Primary Insurance Card
                              </Typography>
                            </Grid>
                            <Grid container direction="row" spacing={2}>
                              {insuranceCards.map((card, index) => (
                                <CardGridItem
                                  key={card.type}
                                  card={card}
                                  index={index}
                                  appointmentID={appointmentID}
                                  cards={insuranceCards}
                                  fullCardPdf={fullCardPdfs.find((pdf) => pdf.type === DocumentType.FullInsurance)}
                                  setZoomedIdx={setZoomedIdx}
                                  setPhotoZoom={setPhotoZoom}
                                  title="Download Insurance Card"
                                />
                              ))}
                            </Grid>
                          </Grid>
                        )}
                        {!selfPay && insuranceCardsSecondary.length > 0 && (
                          <Grid item xs={12} sm={6}>
                            <Grid item>
                              <Typography color="primary.dark" variant="body2">
                                Secondary Insurance Card
                              </Typography>
                            </Grid>
                            <Grid container direction="row" spacing={2}>
                              {insuranceCardsSecondary.map((card, index) => {
                                const offset = insuranceCards.length;
                                return (
                                  <CardGridItem
                                    key={card.type}
                                    card={card}
                                    index={index}
                                    offset={offset}
                                    appointmentID={appointmentID}
                                    cards={insuranceCardsSecondary}
                                    fullCardPdf={fullCardPdfs.find(
                                      (pdf) => pdf.type === DocumentType.FullInsuranceSecondary
                                    )}
                                    setZoomedIdx={setZoomedIdx}
                                    setPhotoZoom={setPhotoZoom}
                                    title="Download Insurance Card"
                                  />
                                );
                              })}
                            </Grid>
                          </Grid>
                        )}
                        {photoIdCards.length > 0 && (
                          <Grid item xs={12} sm={6}>
                            <Grid item>
                              <Typography
                                style={{
                                  marginLeft: !selfPay && insuranceCards.length ? 10 : 0,
                                }}
                                color="primary.dark"
                                variant="body2"
                              >
                                Photo ID
                              </Typography>
                            </Grid>
                            <Grid container direction="row" spacing={2}>
                              {photoIdCards.map((card, index) => {
                                const offset = insuranceCards.length + insuranceCardsSecondary.length;
                                return (
                                  <CardGridItem
                                    key={card.type}
                                    card={card}
                                    index={index}
                                    offset={offset}
                                    appointmentID={appointmentID}
                                    cards={photoIdCards}
                                    fullCardPdf={fullCardPdfs.find((pdf) => pdf.type === DocumentType.FullPhotoId)}
                                    setZoomedIdx={setZoomedIdx}
                                    setPhotoZoom={setPhotoZoom}
                                    title="Download Photo ID"
                                  />
                                );
                              })}
                            </Grid>
                          </Grid>
                        )}
                        {!insuranceCards.length && !photoIdCards.length && !insuranceCardsSecondary.length && (
                          <Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
                            <Typography variant="h3" color="primary.dark">
                              No images have been uploaded <ContentPasteOffIcon />
                            </Typography>
                          </Grid>
                        )}
                      </>
                    </Grid>
                  )}
                </Box>
              </Paper>
            </Grid>

            <Grid container item direction="column">
              <Grid item container sx={{ padding: '10px' }} marginBottom={2}>
                <Typography variant="h3" color="primary.dark">
                  About this visit
                </Typography>
                <Grid container item direction="row" spacing={3}>
                  <Grid container item direction="column" xs={12} sm={6}>
                    <Grid item>
                      <PatientInformation
                        title="Booking details"
                        loading={loading}
                        patientDetails={{
                          ...(unconfirmedDOB
                            ? {
                                "Patient's date of birth (Unmatched)": formatDateUsingSlashes(unconfirmedDOB),
                              }
                            : {}),
                          'Reason for visit': reasonForVisit,
                          'Authorized non-legal guardian(s)':
                            patient?.extension?.find(
                              (e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url
                            )?.valueString || 'none',
                        }}
                        icon={{
                          "Patient's date of birth (Unmatched)": (
                            <PriorityIconWithBorder fill={theme.palette.warning.main} />
                          ),
                        }}
                        editValue={{
                          "Patient's date of birth (Unmatched)": (
                            <PencilIconButton
                              onClick={() =>
                                setEditDialogConfig({
                                  type: 'dob',
                                  values: {
                                    dob:
                                      unconfirmedDOB && DateTime.fromISO(unconfirmedDOB).isValid
                                        ? DateTime.fromISO(unconfirmedDOB)
                                        : null,
                                  },
                                  keyTitleMap: {
                                    dob: 'DOB',
                                  },
                                })
                              }
                              size="16px"
                              sx={{ mr: '5px', padding: '10px' }}
                            />
                          ),
                          'Reason for visit': (
                            <PencilIconButton
                              onClick={() =>
                                setEditDialogConfig({
                                  type: 'reason-for-visit',
                                  values: { reasonForVisit },
                                  keyTitleMap: { reasonForVisit: 'Reason for Visit' },
                                })
                              }
                              size="16px"
                              sx={{ mr: '5px', padding: '10px' }}
                            />
                          ),
                          'Authorized non-legal guardian(s)': (
                            <PencilIconButton
                              onClick={() =>
                                setEditDialogConfig({
                                  type: 'nlg',
                                  values: { guardians: authorizedGuardians },
                                  keyTitleMap: { guardians: 'Guardians' },
                                })
                              }
                              size="16px"
                              sx={{ mr: '5px', padding: '10px' }}
                            />
                          ),
                        }}
                        lastModifiedBy={{
                          "Patient's date of birth (Unmatched)": dobLastModifiedOld || dobLastModified,
                        }}
                      />
                    </Grid>
                    <Grid item>
                      {/* Completed pre-visit forms */}
                      <PatientInformation
                        title="Completed consent forms"
                        loading={loading}
                        editValue={
                          signedConsentForm[consentToTreatPatientDetailsKey] === 'Signed'
                            ? consentEditProp()
                            : undefined
                        }
                        patientDetails={{
                          ...signedConsentForm,
                        }}
                      />
                    </Grid>
                  </Grid>
                  <Grid container item xs={12} sm={6} direction="column">
                    <Grid item>
                      <PatientPaymentList
                        patient={patient}
                        loading={loading}
                        encounterId={encounter?.id ?? ''}
                        patientSelectSelfPay={selfPay}
                        responsibleParty={{
                          fullName: '',
                          email: '',
                        }}
                      />
                    </Grid>
                    <Grid item>
                      <AppointmentNotesHistory
                        appointment={appointment}
                        timezone={locationTimeZone}
                        curNoteAndHistory={notesHistory}
                        user={user}
                        oystehr={oystehr}
                        setAppointment={setAppointment}
                        getAndSetHistoricResources={getAndSetHistoricResources}
                      ></AppointmentNotesHistory>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
            <Grid item paddingY="10px" sx={{ padding: '10px' }} marginBottom={2}>
              <Typography variant="h3" color="primary.dark" marginBottom={2}>
                About this patient
              </Typography>
              <PatientAccountComponent
                id={patient?.id}
                loadingComponent={<Skeleton width={200} height={40} />}
                renderBackButton={false}
              />
            </Grid>
          </Grid>
        </Grid>
        {!loading && encounter && (
          <Grid container direction="row" justifyContent="space-between">
            {isInPerson && (
              <Grid item>
                {loading || !status ? (
                  <Skeleton sx={{ marginLeft: { xs: 0, sm: 2 } }} aria-busy="true" width={200} />
                ) : (
                  <div id="user-set-appointment-status">
                    <FormControl size="small" sx={{ marginTop: 2, marginLeft: { xs: 0, sm: 8 } }}>
                      <ChangeStatusDropdown
                        appointmentID={appointmentID}
                        onStatusChange={isInPerson ? setStatus : () => {}}
                        getAndSetResources={getAndSetHistoricResources}
                        dataTestId={dataTestIds.appointmentPage.changeStatusDropdown}
                      />
                    </FormControl>
                    {loading && <CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }} />}
                  </div>
                )}
              </Grid>
            )}
            <Grid item sx={{ paddingTop: 2, paddingRight: isInPerson ? 3.5 : 0 }}>
              <>
                <Button
                  variant="outlined"
                  sx={{
                    alignSelf: 'center',
                    marginLeft: { xs: 0, sm: isInPerson ? 1 : 0 },
                    borderRadius: '20px',
                    textTransform: 'none',
                  }}
                  color="error"
                  onClick={() => setIssueDialogOpen(true)}
                >
                  Report Issue
                </Button>
                <ReportIssueDialog
                  open={issueDialogOpen}
                  handleClose={() => setIssueDialogOpen(false)}
                  oystehr={oystehr}
                  patient={patient}
                  appointment={appointment}
                  encounter={encounter}
                  locationId={visitDetailsData.visitLocationId}
                  setSnackbarOpen={setSnackbarOpen}
                  setToastType={setToastType}
                  setToastMessage={setToastMessage}
                />
              </>
            </Grid>
          </Grid>
        )}
        <Grid container direction="row">
          <Grid item sx={{ marginLeft: { xs: 0, sm: 8 }, marginTop: 2, marginBottom: 50 }}>
            <>
              <LoadingButton
                loading={activityLogsLoading}
                variant="outlined"
                sx={{
                  alignSelf: 'center',
                  marginLeft: 'auto',
                  borderRadius: '20px',
                  textTransform: 'none',
                }}
                size="medium"
                color="primary"
                onClick={() => setActivityLogDialogOpen(true)}
              >
                View activity logs
              </LoadingButton>
              <ActivityLogDialog
                open={activityLogDialogOpen}
                handleClose={() => setActivityLogDialogOpen(false)}
                logs={activityLogs || []}
              />
            </>
          </Grid>
        </Grid>
        {/* Update details modal */}
        <EditPatientInfoDialog
          title={dialogTitleFromType(editDialogConfig.type)}
          modalOpen={editDialogConfig.type !== 'closed'}
          onClose={() => {
            setEditDialogConfig(CLOSED_EDIT_DIALOG);
          }}
          input={
            <>
              {Object.entries(editDialogConfig.values).map(([key, value], idx) => {
                if (editDialogConfig.type === 'dob' && key === 'dob') {
                  return (
                    <DateSearch
                      key={key}
                      date={value as DateTime | null}
                      setDate={(date) =>
                        setEditDialogConfig(
                          (prev) =>
                            ({
                              ...prev,
                              values: {
                                ...prev.values,
                                [key]: date,
                              },
                            }) as EditDialogConfig
                        )
                      }
                    />
                  );
                } else if (editDialogConfig.type === 'reason-for-visit' && key === 'reasonForVisit') {
                  return (
                    <>
                      <Select
                        id="reason-for-visit-select"
                        value={value}
                        required
                        fullWidth
                        onChange={(e) =>
                          setEditDialogConfig(
                            (prev) =>
                              ({
                                ...prev,
                                values: {
                                  ...prev.values,
                                  [key]: e.target.value,
                                },
                              }) as EditDialogConfig
                          )
                        }
                      >
                        {BOOKING_CONFIG.reasonForVisitOptions.map((reason) => (
                          <MenuItem key={reason} value={reason}>
                            {reason}
                          </MenuItem>
                        ))}
                      </Select>
                    </>
                  );
                } else if (editDialogConfig.type !== 'closed') {
                  return (
                    <TextField
                      key={key}
                      label={editDialogConfig.keyTitleMap[key as keyof typeof editDialogConfig.keyTitleMap] || key}
                      required
                      fullWidth
                      value={value}
                      onChange={(e) =>
                        setEditDialogConfig(
                          (prev) =>
                            ({
                              ...prev,
                              values: {
                                ...prev.values,
                                [key]: e.target.value,
                              },
                            }) as EditDialogConfig
                        )
                      }
                      sx={idx > 0 ? { mt: 2 } : {}}
                    />
                  );
                } else {
                  return null;
                }
              })}
            </>
          }
          onSubmit={async (e) => {
            e.preventDefault(); // don't reload the whole page
            await handleUpdateBookingDetails();
          }}
          submitButtonName="Update"
          error={bookingDetailsMutation.isError}
          errorMessage={bookingDetailsMutation.error?.message}
          loading={bookingDetailsMutation.isPending || visitDetailsAreRefreshing}
          modalDetails={
            editDialogConfig.type === 'dob' ? (
              <Grid container spacing={2} sx={{ mt: '24px' }}>
                <Grid container item>
                  <Grid item width="35%">
                    Original DOB:
                  </Grid>
                  <Grid item>{formatDateUsingSlashes(patient?.birthDate)}</Grid>
                </Grid>

                {unconfirmedDOB && (
                  <Grid container item>
                    <Grid item width="35%">
                      Unmatched DOB:
                    </Grid>
                    <Grid item>{formatDateUsingSlashes(unconfirmedDOB)}</Grid>
                  </Grid>
                )}
              </Grid>
            ) : undefined
          }
        />
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          message={toastMessage}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity={toastType} sx={{ width: '100%' }}>
            {toastMessage}
          </Alert>
        </Snackbar>
      </>
    </PageContainer>
  );
}
