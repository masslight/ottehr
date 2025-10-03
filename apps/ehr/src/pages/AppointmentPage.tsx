import { useAuth0 } from '@auth0/auth0-react';
import { otherColors } from '@ehrTheme/colors';
import CircleIcon from '@mui/icons-material/Circle';
import ContentPasteOffIcon from '@mui/icons-material/ContentPasteOff';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  Paper,
  Skeleton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Alert, { AlertColor } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Bundle,
  BundleEntry,
  DocumentReference,
  Encounter,
  FhirResource,
  Flag,
  Location,
  Patient,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { generatePaperworkPdf } from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { isPaperworkPdfOutdated, useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import {
  CONSENT_CODE,
  FHIR_EXTENSION,
  FhirAppointmentType,
  getFullName,
  getPatchOperationForNewMetaTag,
  getPresignedURL,
  getUnconfirmedDOBForAppointment,
  getUnconfirmedDOBIdx,
  getVisitStatus,
  INSURANCE_CARD_CODE,
  isNonPaperworkQuestionnaireResponse,
  PAPERWORK_PDF_ATTACHMENT_TITLE,
  PHOTO_ID_CARD_CODE,
  PRIVACY_POLICY_CODE,
  VisitStatusLabel,
} from 'utils';
import AppointmentNotesHistory from '../components/AppointmentNotesHistory';
import { getAppointmentStatusChip } from '../components/AppointmentTableRow';
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
  cleanUpStaffHistoryTag,
  formatActivityLogs,
  formatNotesHistory,
  formatPaperworkStartedLog,
  getAppointmentAndPatientHistory,
  getCriticalUpdateTagOp,
  NoteHistory,
  sortLogs,
} from '../helpers/activityLogsUtils';
import { getPatchBinary } from '../helpers/fhir';
import { formatDateUsingSlashes, getTimezone } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser from '../hooks/useEvolveUser';
import PageContainer from '../layout/PageContainer';
import { appointmentTypeLabels, DocumentInfo, DocumentType } from '../types/types';
import { PatientAccountComponent } from './PatientInformationPage';

interface Documents {
  photoIdCards: DocumentInfo[];
  insuranceCards: DocumentInfo[];
  insuranceCardsSecondary: DocumentInfo[];
  fullCardPdfs: DocumentInfo[];
  consentPdfUrls: string[];
}

function getMinutesSinceLastActive(lastActive: string): number {
  return DateTime.now().toUTC().diff(DateTime.fromISO(lastActive).toUTC()).as('minutes');
}

function compareCards(
  cardBackType: DocumentType.PhotoIdBack | DocumentType.InsuranceBack | DocumentType.InsuranceBackSecondary
) {
  return (a: DocumentInfo, b: DocumentInfo) => {
    if (a && b) {
      return a.type === cardBackType ? 1 : -1;
    }
    return 0;
  };
}

const getAnswerStringFor = (
  linkId: string,
  flattenedItems: QuestionnaireResponseItem[] | undefined
): string | undefined => {
  const answer = flattenedItems?.find((response: QuestionnaireResponseItem) => response.linkId === linkId)?.answer?.[0]
    ?.valueString;

  return answer;
};

const LAST_ACTIVE_THRESHOLD = 2; // minutes

const consentToTreatPatientDetailsKey = 'Consent Forms signed?';

type AppointmentBundleTypes =
  | Appointment
  | Patient
  | Location
  | Encounter
  | QuestionnaireResponse
  | Flag
  | RelatedPerson;

export default function AppointmentPage(): ReactElement {
  // variables
  const { id: appointmentID } = useParams();
  const { oystehr, oystehrZambda } = useApiClients();
  const { getAccessTokenSilently } = useAuth0();
  const theme = useTheme();

  // state variables
  const [resourceBundle, setResourceBundle] = useState<AppointmentBundleTypes[] | undefined>(undefined);
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [appointment, setAppointment] = useState<Appointment | undefined>(undefined);
  const [paperworkModifiedFlag, setPaperworkModifiedFlag] = useState<Flag | undefined>(undefined);
  const [paperworkInProgressFlag, setPaperworkInProgressFlag] = useState<Flag | undefined>(undefined);
  const [paperworkStartedFlag, setPaperworkStartedFlag] = useState<Flag | undefined>(undefined);
  const [status, setStatus] = useState<VisitStatusLabel | undefined>(undefined);
  const [errors, setErrors] = useState<{ editName?: boolean; editDOB?: boolean; hopError?: string }>({
    editName: false,
    editDOB: false,
  });
  const [toastMessage, setToastMessage] = React.useState<string | undefined>(undefined);
  const [toastType, setToastType] = React.useState<AlertColor | undefined>(undefined);
  const [snackbarOpen, setSnackbarOpen] = React.useState<boolean>(false);
  const [paperworkPdfLoading, setPaperworkPdfLoading] = React.useState<boolean>(false);

  // Update date of birth modal variables
  const [confirmDOBModalOpen, setConfirmDOBModalOpen] = useState<boolean>(false);
  const [DOBConfirmed, setDOBConfirmed] = useState<DateTime | null>(null);
  const [updatingDOB, setUpdatingDOB] = useState<boolean>(false);
  const [validDate, setValidDate] = useState<boolean>(true);

  // Update patient name modal variables
  const [updateNameModalOpen, setUpdateNameModalOpen] = useState<boolean>(false);
  const [updatingName, setUpdatingName] = useState<boolean>(false);
  const [patientFirstName, setPatientFirstName] = useState<string | undefined>(undefined);
  const [patientMiddleName, setPatientMiddleName] = useState<string | undefined>(undefined);
  const [patientLastName, setPatientLastName] = useState<string | undefined>(undefined);
  const [patientSuffix, setPatientSuffix] = useState<string | undefined>(undefined);

  // File variables
  const [z3Documents, setZ3Documents] = useState<DocumentInfo[]>();
  const [imagesLoading, setImagesLoading] = useState<boolean>(true);

  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);
  const [hopQueueDialogOpen, setHopQueueDialogOpen] = useState<boolean>(false);
  const [hopLoading, setHopLoading] = useState<boolean>(false);
  const [photoZoom, setPhotoZoom] = useState<boolean>(false);
  const [zoomedIdx, setZoomedIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [issueDialogOpen, setIssueDialogOpen] = useState<boolean>(false);
  const [activityLogDialogOpen, setActivityLogDialogOpen] = useState<boolean>(false);
  const [activityLogsLoading, setActivityLogsLoading] = useState<boolean>(true);
  const [activityLogs, setActivityLogs] = useState<ActivityLogData[] | undefined>(undefined);
  const [notesHistory, setNotesHistory] = useState<NoteHistory[] | undefined>(undefined);
  const user = useEvolveUser();

  const { documents, isLoadingDocuments, downloadDocument } = useGetPatientDocs(patient?.id ?? '');

  const { location, encounter, questionnaireResponse } = useMemo(() => {
    const location = resourceBundle?.find(
      (resource: FhirResource) => resource.resourceType === 'Location'
    ) as unknown as Location;

    const encounter = resourceBundle?.find(
      (resource: FhirResource) => resource.resourceType === 'Encounter'
    ) as unknown as Encounter;

    const questionnaireResponse = resourceBundle?.find(
      (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse'
    ) as unknown as QuestionnaireResponse;

    return { location, encounter, questionnaireResponse };
  }, [resourceBundle]);

  const fullName = useMemo(() => {
    if (patient) {
      return getFullName(patient);
    }
    return '';
  }, [patient]);

  const selfPay = false; // todo: pull from encounter resource

  const getResourceBundle = useCallback(async () => {
    if (!appointmentID || !oystehr) {
      return;
    }
    // query the fhir database
    const searchResults = (
      await oystehr.fhir.search<AppointmentBundleTypes>({
        resourceType: 'Appointment',
        params: [
          { name: '_id', value: appointmentID },
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
            value: 'Encounter:appointment',
          },
          { name: '_revinclude:iterate', value: 'Flag:encounter' },
        ],
      })
    )
      .unbundle()
      .filter((resource) => isNonPaperworkQuestionnaireResponse(resource) === false);

    if (!searchResults) {
      throw new Error('Could not get appointment, patient, location, and encounter resources from Zap DB');
    }
    setResourceBundle(searchResults || undefined);

    setLoading(false);
  }, [appointmentID, oystehr]);

  useEffect(() => {
    // Update fields in edit patient name dialog
    if (patient) {
      setPatientFirstName(patient?.name?.[0]?.given?.[0]);
      setPatientMiddleName(patient?.name?.[0]?.given?.[1]);
      setPatientLastName(patient?.name?.[0]?.family);
      setPatientSuffix(patient?.name?.[0]?.suffix?.[0]);
    }
  }, [patient]);

  async function handleUpdatePatientName(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setUpdatingName(true);

    try {
      if (!patient?.id) {
        throw new Error('Patient ID not found.');
      }
      if (!oystehr) {
        throw new Error('Oystehr client not found.');
      }

      // Update the FHIR Patient resource
      const patientPatchOps: Operation[] = [
        {
          op: 'replace',
          path: '/name/0/given/0',
          value: patientFirstName?.trim(),
        },
        {
          op: 'replace',
          path: '/name/0/family',
          value: patientLastName?.trim(),
        },
      ];

      const storedMiddleName = patient?.name?.[0]?.given?.[1];
      if (patientMiddleName && !storedMiddleName) {
        patientPatchOps.push({
          op: 'add',
          path: '/name/0/given/1',
          value: patientMiddleName?.trim(),
        });
      } else if (!patientMiddleName && storedMiddleName) {
        patientPatchOps.push({
          op: 'remove',
          path: '/name/0/given/1',
        });
      } else if (patientMiddleName && storedMiddleName) {
        patientPatchOps.push({
          op: 'replace',
          path: '/name/0/given/1',
          value: patientMiddleName?.trim(),
        });
      }

      const updateTag = getCriticalUpdateTagOp(patient, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
      patientPatchOps.push(updateTag);

      const storedSuffix = patient?.name?.[0]?.suffix?.[0];
      if (patientSuffix && !storedSuffix) {
        patientPatchOps.push({
          op: 'add',
          path: '/name/0/suffix',
          value: [patientSuffix],
        });
      } else if (!patientSuffix && storedSuffix) {
        patientPatchOps.push({
          op: 'remove',
          path: '/name/0/suffix',
        });
      } else if (patientSuffix && storedSuffix) {
        patientPatchOps.push({
          op: 'replace',
          path: '/name/0/suffix',
          value: [patientSuffix],
        });
      }

      const removeStaffUpdateTagOp = cleanUpStaffHistoryTag(patient, 'name');
      if (removeStaffUpdateTagOp) patientPatchOps.push(removeStaffUpdateTagOp);

      const updatedPatient = await oystehr.fhir.patch<Patient>({
        resourceType: 'Patient',
        id: patient.id,
        operations: patientPatchOps,
      });

      setPatient(updatedPatient);
      getAndSetHistoricResources({ logs: true }).catch((error) => {
        console.log('error getting activity logs after name update', error);
      });
      setUpdateNameModalOpen(false);
    } catch (error) {
      setErrors({ editName: true });
      console.log('Failed to update patient name: ', error);
    }

    setUpdatingName(false);
  }

  async function handleUpdateDOB(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setUpdatingDOB(true);
    try {
      if (!validDate) {
        throw new Error('Invalid date.');
      }
      if (!appointment?.id || !patient?.id) {
        throw new Error('Appointment ID or patient ID not found.');
      }
      if (!oystehr) {
        throw new Error('Oystehr client not found.');
      }

      const patchRequests = [];

      // Update the FHIR Patient resource
      const patientPatchOps: Operation[] = [
        {
          op: 'replace',
          path: '/birthDate',
          value: DOBConfirmed?.toISODate(),
        },
      ];

      const updateTag = getCriticalUpdateTagOp(patient, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
      patientPatchOps.push(updateTag);

      const removeStaffUpdateTagOp = cleanUpStaffHistoryTag(patient, 'dob');
      if (removeStaffUpdateTagOp) patientPatchOps.push(removeStaffUpdateTagOp);

      const patientPatch = getPatchBinary({
        resourceType: 'Patient',
        resourceId: patient?.id,
        patchOperations: patientPatchOps,
      });

      patchRequests.push(patientPatch);

      // Remove dobNotConfirmed extension from Appointment
      const appointmentExt = appointment?.extension;
      const dobNotConfirmedIdx = getUnconfirmedDOBIdx(appointment);

      if (dobNotConfirmedIdx && dobNotConfirmedIdx >= 0) {
        appointmentExt?.splice(dobNotConfirmedIdx, 1);

        const appointmentPatch = getPatchBinary({
          resourceType: 'Appointment',
          resourceId: appointment?.id,
          patchOperations: [
            {
              op: 'replace',
              path: '/extension',
              value: appointmentExt,
            },
          ],
        });

        patchRequests.push(appointmentPatch);
      }

      // Batch Appointment and Patient updates
      const bundle = await oystehr.fhir.transaction({
        requests: patchRequests,
      });
      setPatient(
        bundle?.entry?.find((entry: any) => entry.resource.resourceType === 'Patient')?.resource as any as Patient
      );
      getAndSetHistoricResources({ logs: true }).catch((error) => {
        console.log('error getting activity logs after dob update', error);
      });
      setConfirmDOBModalOpen(false);
      setDOBConfirmed(null);
    } catch (error) {
      setErrors({ editDOB: true });
      console.log('Failed to update patient DOB: ', error);
    }

    setUpdatingDOB(false);
  }

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
    // set appointment, patient, and flags
    async function setPrimaryResources(): Promise<void> {
      setPatient(
        resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Patient') as Patient | undefined
      );
      setAppointment(
        resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Appointment') as
          | Appointment
          | undefined
      );
      setPaperworkModifiedFlag(
        resourceBundle?.find(
          (resource: FhirResource) =>
            resource.resourceType === 'Flag' &&
            resource.status === 'active' &&
            resource.meta?.tag?.find((tag) => tag.code === 'paperwork-edit')
        ) as Flag | undefined
      );
      setPaperworkInProgressFlag(
        resourceBundle?.find(
          (resource: FhirResource) =>
            resource.resourceType === 'Flag' &&
            resource.status === 'active' &&
            resource.meta?.tag?.find((tag) => tag.code === 'paperwork-in-progress') &&
            resource.period?.start &&
            getMinutesSinceLastActive(resource.period.start) <= LAST_ACTIVE_THRESHOLD
        ) as Flag | undefined
      );
      setPaperworkStartedFlag(
        resourceBundle?.find(
          (resource: FhirResource) =>
            resource.resourceType === 'Flag' &&
            resource.status === 'active' &&
            resource.meta?.tag?.find((tag) => tag.code === 'paperwork-in-progress')
        ) as Flag | undefined
      );
    }

    // call the functions
    // add checks to make sure functions only run if values are not set
    if (!resourceBundle && appointmentID && oystehr) {
      getResourceBundle().catch((error) => {
        console.log(error);
      });
    }

    if (resourceBundle) {
      setPrimaryResources().catch((error) => {
        console.log(error);
      });
    }
  }, [appointmentID, oystehr, getResourceBundle, resourceBundle]);

  console.log('imagesLoading', imagesLoading);

  useEffect(() => {
    async function getFileResources(patientID: string, appointmentID: string): Promise<void> {
      if (!oystehr) {
        return;
      }

      // Search for DocumentReferences
      try {
        setImagesLoading(true);
        const documentReferenceResources: DocumentReference[] = [];
        const authToken = await getAccessTokenSilently();
        const docRefBundle = await oystehr.fhir.batch<DocumentReference>({
          requests: [
            {
              // Consent
              method: 'GET',
              url: `/DocumentReference?_sort=-_lastUpdated&subject=Patient/${patientID}&related=Appointment/${appointmentID}`,
            },
            {
              // Photo ID & Insurance Cards
              method: 'GET',
              url: `/DocumentReference?status=current&related=Patient/${patientID}`,
            },
          ],
        });

        const bundleEntries = docRefBundle?.entry;
        bundleEntries?.forEach((bundleEntry: BundleEntry) => {
          const bundleResource = bundleEntry.resource as Bundle;
          bundleResource.entry?.forEach((entry) => {
            const docRefResource = entry.resource as DocumentReference;
            if (docRefResource) {
              documentReferenceResources.push(docRefResource);
            }
          });
        });

        // Get document info
        const allZ3Documents: DocumentInfo[] = [];

        for (const docRef of documentReferenceResources) {
          const docRefCode = docRef.type?.coding?.[0].code;

          if (
            docRefCode &&
            ([PHOTO_ID_CARD_CODE, CONSENT_CODE, PRIVACY_POLICY_CODE].includes(docRefCode) ||
              (docRefCode === INSURANCE_CARD_CODE && !selfPay))
          ) {
            for (const content of docRef.content) {
              const title = content.attachment.title;
              const z3Url = content.attachment.url;

              if (z3Url && title) {
                if (
                  [PHOTO_ID_CARD_CODE, INSURANCE_CARD_CODE].includes(docRefCode) &&
                  (!title || !Object.values<string>(DocumentType).includes(title))
                ) {
                  continue;
                }

                const presignedUrl = await getPresignedURL(z3Url, authToken);
                if (presignedUrl) {
                  allZ3Documents.push({
                    z3Url: z3Url,
                    presignedUrl: presignedUrl,
                    type: title as DocumentType,
                    code: docRefCode,
                  });
                }
              }
            }
          }
        }

        setZ3Documents(allZ3Documents);
      } catch (error) {
        throw new Error(
          `Failed to get DocumentReferences resources: ${error}. Stringified error: ${JSON.stringify(error)} `
        );
      } finally {
        setImagesLoading(false);
      }
    }

    if (patient?.id && appointmentID && oystehr) {
      getFileResources(patient.id, appointmentID).catch((error) => console.log(error));
    }
  }, [appointmentID, oystehr, getAccessTokenSilently, patient?.id, selfPay, imagesLoading]);

  const { photoIdCards, insuranceCards, insuranceCardsSecondary, fullCardPdfs, consentPdfUrls } =
    useMemo((): Documents => {
      const documents: Documents = {
        photoIdCards: [],
        insuranceCards: [],
        insuranceCardsSecondary: [],
        fullCardPdfs: [],
        consentPdfUrls: [],
      };

      if (!z3Documents) {
        return documents;
      }

      if (z3Documents.length) {
        documents.photoIdCards = z3Documents
          .filter((doc) => [DocumentType.PhotoIdFront, DocumentType.PhotoIdBack].includes(doc.type))
          .sort(compareCards(DocumentType.PhotoIdBack));
        documents.insuranceCards = z3Documents
          .filter((doc) => [DocumentType.InsuranceFront, DocumentType.InsuranceBack].includes(doc.type))
          .sort(compareCards(DocumentType.InsuranceBack));
        documents.insuranceCardsSecondary = z3Documents
          .filter((doc) =>
            [DocumentType.InsuranceFrontSecondary, DocumentType.InsuranceBackSecondary].includes(doc.type)
          )
          .sort(compareCards(DocumentType.InsuranceBackSecondary));
        documents.fullCardPdfs = z3Documents.filter((doc) =>
          [DocumentType.FullInsurance, DocumentType.FullInsuranceSecondary, DocumentType.FullPhotoId].includes(doc.type)
        );
        documents.consentPdfUrls = z3Documents
          .filter((doc) => doc.code === CONSENT_CODE || doc.code === PRIVACY_POLICY_CODE)
          .flatMap((doc) => (doc.presignedUrl ? [doc.presignedUrl] : []));
      }

      return documents;
    }, [z3Documents]);

  // variables for displaying the page
  const appointmentType = (appointment?.appointmentType?.text as FhirAppointmentType) || '';
  const locationTimeZone = getTimezone(location || '');
  const appointmentStartTime = DateTime.fromISO(appointment?.start ?? '').setZone(locationTimeZone);
  const appointmentTime = appointmentStartTime.toLocaleString(DateTime.TIME_SIMPLE);
  const appointmentDate = formatDateUsingSlashes(appointmentStartTime.toISO() || '', locationTimeZone);
  const nameLastModifiedOld = formatLastModifiedTag('name', patient, location);
  const dobLastModifiedOld = formatLastModifiedTag('dob', patient, location);

  const unconfirmedDOB = appointment && getUnconfirmedDOBForAppointment(appointment);
  const getAppointmentType = (appointmentType: FhirAppointmentType | undefined): string => {
    return (appointmentType && appointmentTypeLabels[appointmentType]) || '';
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
              paperworkStartedFlag,
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
    [appointment, oystehr, locationTimeZone, paperworkStartedFlag]
  );

  useEffect(() => {
    if (paperworkStartedFlag) {
      const paperworkStartedActivityLog = formatPaperworkStartedLog(paperworkStartedFlag, locationTimeZone);
      setActivityLogs((prevLogs) => {
        const logsContainPaperworkStarted = prevLogs?.find((log) => log.activityName === ActivityName.paperworkStarted);
        if (logsContainPaperworkStarted) {
          return prevLogs;
        } else {
          const activityLogCopy = prevLogs ? [...prevLogs] : [];
          const updatedActivityLogs = [paperworkStartedActivityLog, ...activityLogCopy];
          return sortLogs(updatedActivityLogs);
        }
      });
    }
  }, [locationTimeZone, paperworkStartedFlag]);

  useEffect(() => {
    if (!activityLogs && appointment && locationTimeZone && oystehr) {
      getAndSetHistoricResources({ logs: true, notes: true }).catch((error) => {
        console.log('error getting activity logs', error);
        setActivityLogsLoading(false);
      });
    }
  }, [activityLogs, setActivityLogs, appointment, locationTimeZone, oystehr, getAndSetHistoricResources]);

  useEffect(() => {
    if (appointment) {
      const encounterStatus = getVisitStatus(appointment, encounter);
      setStatus(encounterStatus);
    } else {
      setStatus(undefined);
    }
  }, [appointment, encounter]);

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
  } = {};

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

  const downloadPaperworkPdf = async (): Promise<void> => {
    setPaperworkPdfLoading(true);
    const existingPaperworkPdfs = documents
      ?.filter((doc) => doc.docName.toLowerCase().includes(PAPERWORK_PDF_ATTACHMENT_TITLE.toLowerCase()))
      ?.sort((a, b) => {
        const dateA = a.whenAddedDate ? new Date(a.whenAddedDate).getTime() : 0;
        const dateB = b.whenAddedDate ? new Date(b.whenAddedDate).getTime() : 0;
        return dateB - dateA;
      });
    const existingPaperworkPdf = existingPaperworkPdfs?.[0];
    try {
      if (existingPaperworkPdf && !isPaperworkPdfOutdated(existingPaperworkPdf, questionnaireResponse)) {
        await downloadDocument(existingPaperworkPdf.id);
        setPaperworkPdfLoading(false);
        return;
      }
    } catch (error) {
      console.warn('Paperwork PDF check failed, regenerating...', error);
    }

    if (!oystehrZambda || !questionnaireResponse.id) {
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
      setPaperworkPdfLoading(false);
      return;
    }
    try {
      const response = await generatePaperworkPdf(oystehrZambda, {
        questionnaireResponseId: questionnaireResponse.id,
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
                    onClick={() => setUpdateNameModalOpen(true)}
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
                  <Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>{location?.name}</Typography>
                  <span
                    style={{
                      marginLeft: 20,
                      alignSelf: 'center',
                    }}
                  >
                    {getAppointmentStatusChip(status)}
                  </span>
                  {appointment && appointment.status === 'cancelled' && (
                    <Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>
                      {appointment?.cancelationReason?.coding?.[0]?.display}
                    </Typography>
                  )}
                </>
              )}
              {appointment && appointment?.status !== 'cancelled' ? (
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
                    getResourceBundle={getResourceBundle}
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

            {paperworkInProgressFlag && (
              <Grid container direction="row" marginTop={2}>
                <PaperworkFlagIndicator
                  title="Paperwork in progress"
                  color={otherColors.infoText}
                  backgroundColor={otherColors.infoBackground}
                  icon={<InfoOutlinedIcon sx={{ color: otherColors.infoIcon }} />}
                />
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
                          'Authorized non-legal guardian(s)': patient?.extension?.find(
                            (e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url
                          )?.valueString,
                        }}
                        icon={{
                          "Patient's date of birth (Unmatched)": (
                            <PriorityIconWithBorder fill={theme.palette.warning.main} />
                          ),
                        }}
                        editValue={{
                          "Patient's date of birth (Original)": (
                            <PencilIconButton
                              onClick={() => setConfirmDOBModalOpen(true)}
                              size="16px"
                              sx={{ mr: '5px', padding: '10px' }}
                            />
                          ),
                          "Patient's date of birth": (
                            <PencilIconButton
                              onClick={() => setConfirmDOBModalOpen(true)}
                              size="16px"
                              sx={{ mr: '5px', padding: '10px' }}
                            />
                          ),
                        }}
                        lastModifiedBy={{ "Patient's date of birth": dobLastModifiedOld || dobLastModified }}
                      />
                    </Grid>
                    <Grid item>
                      {/* Completed pre-visit forms */}
                      {/* todo: grab these things from the Consent resources themselves */}
                      <PatientInformation
                        title="Completed consent forms"
                        loading={loading}
                        editValue={consentEditProp()}
                        patientDetails={{
                          ...signedConsentForm,
                          Signature: getAnswerStringFor('signature', []),
                          'Full name': getAnswerStringFor('full-name', []),
                          'Relationship to patient': getAnswerStringFor('consent-form-signer-relationship', []),
                          Date: formatDateUsingSlashes(questionnaireResponse?.authored),
                          IP: questionnaireResponse?.extension?.find(
                            (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address'
                          )?.valueString,
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
                        location={location}
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
              <PatientAccountComponent id={patient?.id} />
            </Grid>
          </Grid>
        </Grid>
        <Grid container direction="row" justifyContent="space-between">
          <Grid item>
            {loading || !status ? (
              <Skeleton sx={{ marginLeft: { xs: 0, sm: 2 } }} aria-busy="true" width={200} />
            ) : (
              <div id="user-set-appointment-status">
                <FormControl size="small" sx={{ marginTop: 2, marginLeft: { xs: 0, sm: 8 } }}>
                  <ChangeStatusDropdown
                    appointmentID={appointmentID}
                    onStatusChange={setStatus}
                    getAndSetResources={getAndSetHistoricResources}
                    dataTestId={dataTestIds.appointmentPage.changeStatusDropdown}
                  />
                </FormControl>
                {loading && <CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }} />}
              </div>
            )}
          </Grid>
          <Grid item sx={{ paddingTop: 2, paddingRight: 3.5 }}>
            <>
              <Button
                variant="outlined"
                sx={{
                  alignSelf: 'center',
                  marginLeft: { xs: 0, sm: 1 },
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
                location={location}
                setSnackbarOpen={setSnackbarOpen}
                setToastType={setToastType}
                setToastMessage={setToastMessage}
              ></ReportIssueDialog>
            </>
          </Grid>
        </Grid>
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
        {/* Update patient name modal */}
        <EditPatientInfoDialog
          title="Please enter patient's name"
          modalOpen={updateNameModalOpen}
          onClose={() => {
            setUpdateNameModalOpen(false);

            // reset errors and patient name
            setPatientFirstName(patient?.name?.[0]?.given?.[0]);
            setPatientMiddleName(patient?.name?.[0]?.given?.[1]);
            setPatientLastName(patient?.name?.[0]?.family);
            setPatientSuffix(patient?.name?.[0]?.suffix?.[0]);
            setErrors({ editName: false });
          }}
          input={
            <>
              <TextField
                label="Last"
                required
                fullWidth
                value={patientLastName}
                onChange={(e) => setPatientLastName(e.target.value.trimStart())}
              />
              <TextField
                label="First"
                required
                fullWidth
                value={patientFirstName}
                onChange={(e) => setPatientFirstName(e.target.value.trimStart())}
                sx={{ mt: 2 }}
              />
              <TextField
                label="Middle"
                fullWidth
                value={patientMiddleName}
                onChange={(e) => setPatientMiddleName(e.target.value.trimStart())}
                sx={{ mt: 2 }}
              />
            </>
          }
          onSubmit={handleUpdatePatientName}
          submitButtonName="Update Patient Name"
          loading={updatingName}
          error={errors.editName}
          errorMessage="Failed to update patient name"
        />
        {/* Update DOB modal */}
        <EditPatientInfoDialog
          title="Please enter patient's confirmed date of birth"
          modalOpen={confirmDOBModalOpen}
          onClose={() => {
            setConfirmDOBModalOpen(false);
            setDOBConfirmed(null);
            setErrors({ editDOB: false });
          }}
          input={
            <DateSearch
              date={DOBConfirmed}
              setDate={setDOBConfirmed}
              setIsValidDate={setValidDate}
              defaultValue={null}
              label="Date of birth"
              required
            ></DateSearch>
          }
          onSubmit={handleUpdateDOB}
          submitButtonName="Update Date of Birth"
          loading={updatingDOB}
          error={errors.editDOB}
          errorMessage="Failed to update patient date of birth"
          modalDetails={
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
