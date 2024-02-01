import React from 'react';
import {
  Typography,
  Box,
  Grid,
  Button,
  Paper,
  Skeleton,
  CircularProgress,
  capitalize,
  Select,
  SelectChangeEvent,
  MenuItem,
  FormControl,
  FormHelperText,
  InputLabel,
  useTheme,
  IconButton,
  Dialog,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import PageContainer from '../layout/PageContainer';
import { useParams } from 'react-router-dom';
import useFhirClient from '../hooks/useFhirClient';
import {
  Bundle,
  Patient,
  FhirResource,
  Appointment,
  Location,
  Encounter,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  DocumentReference,
} from 'fhir/r4';
import CircleIcon from '@mui/icons-material/Circle';
import { DateTime } from 'luxon';
import PatientInformation from '../components/PatientInformation';
import CancellationReasonDialog from '../components/CancellationReasonDialog';
import { useZ3Client } from '../hooks/useZ3Client';
import { useIntakeZambdaClient } from '../hooks/useIntakeZambdaClient';
import ImageCarousel from '../components/ImageCarousel';
import { CHIP_STATUS_MAP, getAppointmentStatusChip } from '../components/AppointmentTableRow';
import { formatDateUsingSlashes } from '../helpers/formatDateTime';
import { useAuth0 } from '@auth0/auth0-react';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import ContentPasteOffIcon from '@mui/icons-material/ContentPasteOff';
import { formatPhoneNumber } from '../helpers/formatPhoneNumber';
import { otherColors } from '../CustomThemeProvider';
import { getPatchBinary } from '../helpers/fhir';
import { Operation } from 'fast-json-patch';
import CreateOutlinedIcon from '@mui/icons-material/CreateOutlined';
import DateSearch from '../components/DateSearch';
import { Close } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { PriorityIconWithBorder } from '../components/PriorityIconWithBorder';
import {
  OtherEHRVisitStatus,
  OtherEHRVisitStatusWithoutUnknown,
  STATI,
  getPatchOperationsToUpdateVisitStatus,
  getVisitStatusHistory,
  mapOtherEHRVisitStatusToFhirAppointmentStatus,
  mapOtherEHRVisitStatusToFhirEncounterStatus,
} from '../helpers/visitMappingUtils';

export default function AppointmentPage(): ReactElement {
  // variables
  const { id: appointmentID } = useParams();
  const fhirClient = useFhirClient();
  const z3Client = useZ3Client();
  const zambdaClient = useIntakeZambdaClient();
  const { getAccessTokenSilently } = useAuth0();
  const theme = useTheme();

  // state variables
  const [resourceBundle, setResourceBundle] = useState<Bundle[] | undefined>(undefined);
  const [selfPay, setSelfPay] = useState<boolean>(false);
  const [appointment, setAppointment] = useState<Appointment | undefined>(undefined);
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [location, setLocation] = useState<Location | undefined>(undefined);
  const [encounter, setEncounter] = useState<Encounter>({} as Encounter);
  const [questionnaireResponse, setQuestionnaireResponse] = useState<QuestionnaireResponse | undefined>(undefined);
  const [status, setStatus] = useState<OtherEHRVisitStatus | undefined>(undefined);
  const [confirmDOBModalOpen, setConfirmDOBModalOpen] = useState<boolean>(false);
  const [DOBConfirmed, setDOBConfirmed] = useState<DateTime | null>(null);
  const [updatingDOB, setUpdatingDOB] = useState<boolean>(false);
  const [validDate, setValidDate] = useState<boolean>(true);

  // photo Id variables
  const [imagesLoading, setImagesLoading] = useState<boolean>(true);
  const [photoIdFrontUrl, setPhotoIdFrontUrl] = useState<string | undefined>(undefined);
  const [photoIdBackUrl, setPhotoIdBackUrl] = useState<string | undefined>(undefined);
  const [insuranceCardFrontUrl, setInsuranceCardFrontUrl] = useState<string | undefined>(undefined);
  const [insuranceCardBackUrl, setInsuranceCardBackUrl] = useState<string | undefined>(undefined);
  const [imagesArray, setImagesArray] = useState<string[]>([]);
  const [imageAltsArray, setImageAltsArray] = useState<string[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);
  const [photoZoom, setPhotoZoom] = useState<boolean>(false);
  const [zoomedIdx, setZoomedIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusLoading, setStatusLoading] = useState<boolean>(false);

  // functions
  const getAnswerStringFor = (linkId: string): string | undefined => {
    const answer = questionnaireResponse?.item?.find(
      (response: QuestionnaireResponseItem) => response.linkId === linkId,
    )?.answer?.[0]?.valueString;

    return answer;
  };

  async function updateStatusForAppointment(event: SelectChangeEvent): Promise<void> {
    if (!appointment || !appointment.id) {
      throw new Error('Appointment is not defined');
    }
    if (!encounter || !encounter.id) {
      throw new Error('Encounter is not defined');
    }
    if (!fhirClient) {
      throw new Error('fhirClient is not defined');
    }
    setStatusLoading(true);

    const updatedStatus = event.target.value as OtherEHRVisitStatusWithoutUnknown;
    const visitOperations = getPatchOperationsToUpdateVisitStatus(appointment, updatedStatus);
    const updatedFhirAppointmentStatus = mapOtherEHRVisitStatusToFhirAppointmentStatus(updatedStatus);
    const updatedFhirEncounterStatus = mapOtherEHRVisitStatusToFhirEncounterStatus(updatedStatus);

    const patchOps: Operation[] = [
      ...visitOperations,
      {
        op: 'replace',
        path: '/status',
        value: updatedFhirAppointmentStatus,
      },
    ];

    if (appointment.status === 'cancelled') {
      patchOps.push({
        op: 'remove',
        path: '/cancelationReason',
      });
    }

    const appointmentPatch = getPatchBinary({
      resourceType: 'Appointment',
      resourceId: appointment.id,
      patchOperations: patchOps,
    });
    const encounterPatch = getPatchBinary({
      resourceType: 'Encounter',
      resourceId: encounter.id,
      patchOperations: [
        {
          op: 'replace',
          path: '/status',
          value: updatedFhirEncounterStatus,
        },
      ],
    });
    setStatus(updatedStatus);
    await fhirClient.transactionRequest({
      requests: [appointmentPatch, encounterPatch],
    });
    await getResourceBundle();
    setStatusLoading(false);
  }

  const getResourceBundle = useCallback(async () => {
    if (!appointmentID || !fhirClient) {
      return;
    }
    // query the fhir database
    const searchResults = await fhirClient.searchResources<Bundle>({
      resourceType: 'Appointment',
      searchParams: [
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
        {
          name: '_revinclude:iterate',
          value: 'QuestionnaireResponse:encounter',
        },
      ],
    });
    if (!searchResults) {
      throw new Error('Could not get appointment, patient, location, and encounter resources from Zap DB');
    }
    setResourceBundle(searchResults || undefined);

    setLoading(false);
  }, [appointmentID, fhirClient]);

  async function handleUpdateDOB(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (validDate) {
      setUpdatingDOB(true);
      if (appointment?.id && patient?.id) {
        const appointmentExt = appointment?.extension;
        const dobNotConfirmedIdx = appointmentExt?.findIndex(
          (e) => e.url === 'http://fhir.zapehr.com/r4/StructureDefinitions/date-of-birth-not-confirmed',
        );
        if (dobNotConfirmedIdx !== undefined) {
          appointmentExt?.splice(dobNotConfirmedIdx, 1);
        }
        const apptPatchOps: Operation[] = [];
        if (appointmentExt) {
          apptPatchOps.push({
            op: 'replace',
            path: '/extension',
            value: appointmentExt,
          });
        } else {
          apptPatchOps.push({
            op: 'remove',
            path: '/extension',
          });
        }
        const appointmentPatch = getPatchBinary({
          resourceType: 'Appointment',
          resourceId: appointment?.id,
          patchOperations: apptPatchOps,
        });
        const patientPatch = getPatchBinary({
          resourceType: 'Patient',
          resourceId: patient?.id,
          patchOperations: [
            {
              op: 'replace',
              path: '/birthDate',
              value: DOBConfirmed?.toISODate(),
            },
          ],
        });
        const bundle = await fhirClient?.transactionRequest({
          requests: [appointmentPatch, patientPatch],
        });
        setPatient(
          bundle?.entry?.find((entry: any) => entry.resource.resourceType === 'Patient')?.resource as any as Patient,
        );
        setUpdatingDOB(false);
        setConfirmDOBModalOpen(false);
        setDOBConfirmed(null);
      }
    }
  }

  useEffect(() => {
    if (questionnaireResponse) {
      const paymentOption = questionnaireResponse?.item?.find(
        (response: QuestionnaireResponseItem) => response.linkId === 'payment-option',
      )?.answer?.[0].valueString;

      setSelfPay(!paymentOption || paymentOption === 'I will pay without insurance');
    }
  }, [questionnaireResponse]);

  useEffect(() => {
    // set appointment, patient, location, encounter, questionnaireResponse
    async function setPrimaryResources(): Promise<void> {
      setAppointment(
        resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Appointment') as any as Appointment,
      );
      setPatient(
        resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Patient') as any as Patient,
      );
      setLocation(
        resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Location') as any as Location,
      );
      setEncounter(
        resourceBundle?.find((resource: FhirResource) => resource.resourceType === 'Encounter') as any as Encounter,
      );
      setQuestionnaireResponse(
        resourceBundle?.find(
          (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse',
        ) as any as QuestionnaireResponse,
      );
    }

    // call the functions
    // add checks to make sure functions only run if values are not set
    if (!resourceBundle && appointmentID && fhirClient) {
      getResourceBundle().catch((error) => {
        console.log(error);
      });
    }

    if (resourceBundle && z3Client && zambdaClient) {
      setPrimaryResources().catch((error) => {
        console.log(error);
      });
    }

    // only set self pay if questionnaire has been set
    if (questionnaireResponse) {
      const paymentOption = questionnaireResponse?.item?.find(
        (response: QuestionnaireResponseItem) => response.linkId === 'payment-option',
      )?.answer?.[0].valueString;
      setSelfPay(!paymentOption || paymentOption === 'I will pay without insurance');
    }
  }, [appointmentID, fhirClient, getResourceBundle, resourceBundle, z3Client, zambdaClient, questionnaireResponse]);

  useEffect(() => {
    // function for getting the signed url from the unsigned url
    async function getSignedUrl(unsignedUrl: string): Promise<string | undefined> {
      if (!unsignedUrl) {
        return;
      }
      // get auth token
      const authToken = await getAccessTokenSilently();

      // get signedUrl
      const fetchParams = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action: 'download' }),
      };
      const signedUrlResponse = await fetch(unsignedUrl, fetchParams);
      const signedUrlJSON = await signedUrlResponse.json();

      return signedUrlJSON.signedUrl;
    }

    async function setUrlResources(): Promise<void> {
      // get the current photo id and insurance card DocumentReference objects, if they exist
      const documentReferenceSearchParams = {
        resourceType: 'DocumentReference',
        searchParams: [
          {
            name: 'related',
            value: `Patient/${patient?.id}`,
          },
          { name: 'status', value: 'current' },
        ],
      };
      const documentReferenceObjects: DocumentReference[] | undefined =
        await fhirClient?.searchResources(documentReferenceSearchParams);

      // if the search failed, throw an error
      if (!documentReferenceObjects) {
        throw new Error('unable to search for DocumentReference objects');
      }

      // set Url and Image variables based on the results
      const newImagesArray: (string | undefined)[] = new Array(4).fill(undefined);
      const newImageAltsArray: (string | undefined)[] = new Array(4).fill(undefined);
      for (const docRef of documentReferenceObjects) {
        for (const contentObject of docRef.content) {
          if (!contentObject.attachment.url) {
            continue;
          }
          const signedUrl = await getSignedUrl(contentObject.attachment.url);
          if (contentObject.attachment.title === 'insurance-card-front' && !selfPay) {
            setInsuranceCardFrontUrl(signedUrl);
            newImagesArray[0] = signedUrl;
            newImageAltsArray[0] = 'Insurance card front';
          } else if (contentObject.attachment.title === 'insurance-card-back' && !selfPay) {
            setInsuranceCardBackUrl(signedUrl);
            newImagesArray[1] = signedUrl;
            newImageAltsArray[1] = 'Insurance card back';
          } else if (contentObject.attachment.title === 'id-front') {
            setPhotoIdFrontUrl(signedUrl);
            newImagesArray[2] = signedUrl;
            newImageAltsArray[2] = 'Photo ID card front';
          } else if (contentObject.attachment.title === 'id-back') {
            setPhotoIdBackUrl(signedUrl);
            newImagesArray[3] = signedUrl;
            newImageAltsArray[3] = 'Photo ID card back';
          }
        }
      }
      const filteredImagesArray: string[] = newImagesArray.filter((url) => url !== undefined) as string[];
      const filteredImageAltsArray: string[] = newImageAltsArray.filter((url) => url !== undefined) as string[];

      setImagesArray(filteredImagesArray);
      setImageAltsArray(filteredImageAltsArray);
      setImagesLoading(false);
    }

    if (patient?.id && fhirClient) {
      setUrlResources().catch((error) => console.log(error));
    }
  }, [fhirClient, getAccessTokenSilently, patient?.id, selfPay]);

  // variables for displaying the page
  const appointmentStartTime = DateTime.fromISO(appointment?.start ?? '');
  const appointmentTime = appointmentStartTime.toLocaleString(DateTime.TIME_SIMPLE);
  const appointmentDate = appointmentStartTime.toFormat('LL.dd.y');
  const cityStateZipString = getAnswerStringFor('patient-city')
    ? `${getAnswerStringFor('patient-city') || ''}, ${getAnswerStringFor('patient-state') || ''}, ${
        getAnswerStringFor('patient-zip') || ''
      }`
    : '';
  const fullNameString =
    getAnswerStringFor('responsible-party-first-name') && getAnswerStringFor('responsible-party-first-name')
      ? `${getAnswerStringFor('responsible-party-first-name')} ${getAnswerStringFor('responsible-party-last-name')}`
      : undefined;
  const pcpNameString =
    getAnswerStringFor('pcp-first') && getAnswerStringFor('pcp-last')
      ? `${getAnswerStringFor('pcp-first')} ${getAnswerStringFor('pcp-last')}`
      : undefined;
  const unconfirmedDOB: string | undefined = appointment?.extension?.find(
    (e) => e.url === 'http://fhir.zapehr.com/r4/StructureDefinitions/date-of-birth-not-confirmed',
  )?.valueString;

  React.useEffect(() => {
    if (appointment) {
      const encounterStatus = getStatusFromExtension(appointment);
      setStatus(encounterStatus);
    } else {
      setStatus(undefined);
    }
  }, [appointment]);

  // page HTML
  const handleCancelDialogOpen = (): void => {
    setCancelDialogOpen(true);
  };

  const handleCancelDialogClose = (): void => {
    setCancelDialogOpen(false);
  };

  return (
    <PageContainer>
      <>
        {/* Card image zoom dialog */}
        <ImageCarousel
          images={imagesArray}
          imageAlts={imageAltsArray}
          imageIndex={zoomedIdx}
          setImageIndex={setZoomedIdx}
          open={photoZoom}
          setOpen={setPhotoZoom}
        />
        {/* page */}
        <Grid container direction="row">
          <Grid item xs={0.25}></Grid>
          <Grid item xs={11.5}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/appointments', children: 'Tracking Board' },
                { link: '#', children: appointment?.id || <Skeleton width={150} /> },
              ]}
            />

            {/* page title row */}
            <Grid container direction="row" marginTop={1}>
              {loading || !patient ? (
                <Skeleton aria-busy="true" width={200} height="" />
              ) : (
                <Typography variant="h2" color="primary.dark">
                  {patient?.name?.[0]?.family}, {patient?.name?.[0]?.given?.[0]}
                </Typography>
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
                    Booked
                  </Typography>
                  <Typography sx={{ alignSelf: 'center', marginLeft: 1 }} fontWeight="bold">
                    {appointmentTime}
                  </Typography>
                  <Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>
                    {DateTime.fromFormat(appointmentDate, 'mm.dd.yy').toFormat('mm/dd/y')}
                  </Typography>
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
                  />
                </>
              ) : null}
            </Grid>

            {/* insurance card and photo id */}
            <Grid container direction="row" marginTop={2}>
              <Paper sx={{ width: '100%' }}>
                <Box padding={3}>
                  <Grid container direction="row" rowGap={2} height="20px" maxHeight="20px">
                    {!imagesLoading && (
                      <>
                        {!selfPay && (insuranceCardFrontUrl || insuranceCardBackUrl) && (
                          <Grid item xs={insuranceCardFrontUrl && insuranceCardBackUrl ? 6 : 3}>
                            <Typography color="primary.dark" variant="body2">
                              Insurance Card
                            </Typography>
                          </Grid>
                        )}
                        {(photoIdFrontUrl || photoIdBackUrl) && (
                          <Grid item xs={6}>
                            <Typography
                              style={{
                                marginLeft: !selfPay && (insuranceCardFrontUrl || insuranceCardBackUrl) ? 10 : 0,
                              }}
                              color="primary.dark"
                              variant="body2"
                            >
                              Photo ID
                            </Typography>
                          </Grid>
                        )}
                      </>
                    )}
                  </Grid>

                  <Grid container direction="row" maxHeight="210px" height="210px" spacing={2}>
                    {(imagesLoading && (
                      <Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
                        <CircularProgress sx={{ justifySelf: 'center' }} />
                      </Grid>
                    )) || (
                      <>
                        {imagesArray.map((imageUrl, index) => (
                          <Grid key={imageUrl} display="flex" item xs={3} boxSizing="border-box">
                            <Box
                              border={`1px solid ${otherColors.dottedLine}`}
                              height="170px"
                              width="100%"
                              my={1}
                              borderRadius={2}
                            >
                              <Box
                                onClick={() => {
                                  setZoomedIdx(index);
                                  setPhotoZoom(true);
                                }}
                                sx={{ cursor: 'pointer' }}
                                display="flex"
                                justifyContent="center"
                                alignItems="center"
                                height="100%"
                              >
                                <img
                                  src={imageUrl}
                                  alt={imageAltsArray[index]}
                                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                        ))}

                        {imagesArray.length === 0 && (
                          <Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
                            <Typography variant="h3" color="primary.dark">
                              No images have been uploaded <ContentPasteOffIcon />
                            </Typography>
                          </Grid>
                        )}
                      </>
                    )}
                  </Grid>
                </Box>
              </Paper>
            </Grid>

            {/* information sections */}
            <Grid container direction="row">
              <Grid item xs={6} paddingRight={2}>
                {/* About the patient */}
                <PatientInformation
                  title="About the patient"
                  loading={loading}
                  patientDetails={{
                    ...(unconfirmedDOB
                      ? {
                          "Patient's date of birth (Original)": formatDateUsingSlashes(patient?.birthDate),
                          "Patient's date of birth (Unmatched)": formatDateUsingSlashes(unconfirmedDOB),
                        }
                      : {
                          "Patient's date of birth": formatDateUsingSlashes(patient?.birthDate),
                        }),
                    "Patient's sex": patient?.gender ? capitalize(patient?.gender) : '',
                    'Reason for visit': appointment?.description,
                  }}
                  icon={{
                    "Patient's date of birth (Unmatched)": <PriorityIconWithBorder fill={theme.palette.warning.main} />,
                  }}
                  editValue={{
                    "Patient's date of birth (Original)": (
                      <IconButton
                        sx={{ width: '16px', height: '16px', color: '#4AC0F2', marginLeft: '7px', padding: '10px' }}
                        onClick={() => {
                          setConfirmDOBModalOpen(true);
                        }}
                      >
                        <CreateOutlinedIcon sx={{ width: '16px', height: '16px' }} />
                      </IconButton>
                    ),
                  }}
                />
                {/* Contact information */}
                <PatientInformation
                  title="Contact information"
                  loading={loading}
                  patientDetails={{
                    'Street address': getAnswerStringFor('patient-street-address'),
                    'Address line 2': getAnswerStringFor('patient-street-address-2'),
                    'City, State, ZIP': cityStateZipString,
                    'I am filling out this info as': getAnswerStringFor('patient-filling-out-as'),
                    'Patient email': getAnswerStringFor('patient-email'),
                    'Patient mobile': formatPhoneNumber(getAnswerStringFor('patient-number')),
                    'Parent/Guardian email': getAnswerStringFor('guardian-email'),
                    'Parent/Guardian mobile': formatPhoneNumber(getAnswerStringFor('guardian-number')),
                  }}
                />
                {/* Patient details */}
                <PatientInformation
                  title="Patient details"
                  loading={loading}
                  patientDetails={{
                    "Patient's ethnicity": getAnswerStringFor('patient-ethnicity'),
                    "Patient's race": getAnswerStringFor('patient-race'),
                    "Patient's pronouns":
                      getAnswerStringFor('patient-pronouns') === 'My pronounces are not listed'
                        ? getAnswerStringFor('patient-pronouns-custom')
                        : getAnswerStringFor('patient-pronouns'),
                    'PCP name': pcpNameString,
                    'PCP phone number': formatPhoneNumber(getAnswerStringFor('pcp-number')),
                    'Pharmacy name': getAnswerStringFor('pharmacy-name'),
                    'Pharmacy address': getAnswerStringFor('pharmacy-address'),
                    'Pharmacy phone number': formatPhoneNumber(getAnswerStringFor('pharmacy-phone')),
                    'How did you hear about us?': patient?.extension?.find(
                      (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery',
                    )?.valueString,
                  }}
                />
              </Grid>
              <Grid item xs={6} paddingLeft={2}>
                {/* Insurance information */}
                {!selfPay && (
                  <PatientInformation
                    title="Insurance information"
                    loading={loading}
                    patientDetails={{
                      'Insurance Carrier': getAnswerStringFor('insurance-carrier'),
                      'Member ID': getAnswerStringFor('insurance-member-id'),
                      "Policy holder's name":
                        getAnswerStringFor('policy-holder-first-name') &&
                        getAnswerStringFor('policy-holder-last-name') &&
                        `${getAnswerStringFor('policy-holder-first-name')}, ${getAnswerStringFor(
                          'policy-holder-last-name',
                        )}`,
                      "Policy holder's date of birth": formatDateUsingSlashes(
                        questionnaireResponse?.item?.find(
                          (response: QuestionnaireResponseItem) => response.linkId === 'policy-holder-date-of-birth',
                        )?.answer?.[0]?.valueDate,
                      ),
                      "Policy holder's sex": getAnswerStringFor('policy-holder-birth-sex'),
                      "Patient's relationship to the insured": getAnswerStringFor('patient-relationship-to-insured'),
                      'Additional insurance information': getAnswerStringFor('insurance-additional-information'),
                    }}
                  />
                )}

                {/* Responsible party information */}
                <PatientInformation
                  title="Responsible party information"
                  loading={loading}
                  patientDetails={{
                    'Relationship ': getAnswerStringFor('responsible-party-relationship'),
                    'Full name': fullNameString,
                    'Date of birth': formatDateUsingSlashes(
                      questionnaireResponse?.item?.find(
                        (response: QuestionnaireResponseItem) => response.linkId === 'responsible-party-date-of-birth',
                      )?.answer?.[0]?.valueDate,
                    ),
                    'Birth sex': getAnswerStringFor('responsible-party-birth-sex'),
                    'Phone ': formatPhoneNumber(getAnswerStringFor('responsible-party-number')),
                  }}
                />

                {/* Completed pre-visit forms */}
                <PatientInformation
                  title="Completed consent forms"
                  loading={loading}
                  patientDetails={{
                    'I have reviewed and accept HIPAA Acknowledgement': questionnaireResponse?.item?.find(
                      (response: QuestionnaireResponseItem) => response.linkId === 'hipaa-acknowledgement',
                    )?.answer?.[0]?.valueBoolean
                      ? 'Signed'
                      : 'Not signed',
                    'I have reviewed and accept Consent to Treat and Guarantee of Payment':
                      questionnaireResponse?.item?.find(
                        (response: QuestionnaireResponseItem) => response.linkId === 'consent-to-treat',
                      )?.answer?.[0]?.valueBoolean
                        ? 'Signed'
                        : 'Not signed',
                    'Signature ': getAnswerStringFor('signature'),
                    'Full name': getAnswerStringFor('full-name'),
                    'Relationship to patient': getAnswerStringFor('consent-form-signer-relationship'),
                    'Date ': formatDateUsingSlashes(questionnaireResponse?.authored),
                    'IP ': questionnaireResponse?.extension?.find(
                      (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address',
                    )?.valueString,
                  }}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        {loading || !status ? (
          <Skeleton sx={{ marginLeft: 2 }} aria-busy="true" width={200} />
        ) : (
          <div id="user-set-appointment-status">
            <FormControl size="small" sx={{ marginTop: 2, marginLeft: 8, marginBottom: 50 }}>
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                id="appointment-status"
                value={status}
                label="Status"
                onChange={updateStatusForAppointment}
                sx={{
                  backgroundColor: CHIP_STATUS_MAP[status].background.primary,
                  color: CHIP_STATUS_MAP[status].color.primary,
                  '& #appointment-status': {
                    // paddingLeft: 2,
                    // paddingRight: 4,
                    // paddingTop: 0.5,
                    // paddingBottom: 0.5,
                  },
                }}
              >
                {STATI.filter((statusTemp) => {
                  const removeStati = ['NO-SHOW', 'UNKNOWN'];
                  if (status !== 'CANCELLED') removeStati.push('CANCELLED');
                  return !removeStati.includes(statusTemp);
                }).map((statusTemp) => (
                  <MenuItem
                    key={statusTemp}
                    value={statusTemp}
                    sx={{
                      backgroundColor: CHIP_STATUS_MAP[statusTemp].background.primary,
                      color: CHIP_STATUS_MAP[statusTemp].color.primary,
                      ':hover': {
                        backgroundColor: CHIP_STATUS_MAP[statusTemp].background.primary,
                        filter: 'brightness(0.95)',
                        // opacity: 0.95,
                      },
                    }}
                  >
                    {statusTemp}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Changing a status will not update anything in eClinicalWorks.</FormHelperText>
            </FormControl>
            {statusLoading && <CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }} />}
          </div>
        )}
        <Dialog
          open={confirmDOBModalOpen}
          onClose={() => {
            setConfirmDOBModalOpen(false);
            setDOBConfirmed(null);
          }}
        >
          <Paper>
            <Box maxWidth="sm">
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', paddingRight: '16px' }}>
                <IconButton
                  aria-label="Close"
                  onClick={() => {
                    setConfirmDOBModalOpen(false);
                    setDOBConfirmed(null);
                  }}
                >
                  <Close />
                </IconButton>
              </Box>
              <Box margin={'0 40px 40px 40px'}>
                <form onSubmit={handleUpdateDOB}>
                  <Typography sx={{ width: '100%' }} variant="h4" color="primary.main">
                    Please enter patient&apos;s confirmed date of birth
                  </Typography>
                  <Box sx={{ my: '24px' }}>
                    <DateSearch
                      date={DOBConfirmed}
                      setDate={setDOBConfirmed}
                      setValidDate={setValidDate}
                      defaultValue={null}
                      label="Date of birth"
                      required
                      ageRange={{ min: 0, max: 26 }}
                    ></DateSearch>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <LoadingButton
                      sx={{
                        borderRadius: 100,
                        textTransform: 'none',
                        fontWeight: 600,
                        marginRight: 1,
                      }}
                      variant="contained"
                      type="submit"
                      loading={updatingDOB}
                    >
                      Update Date of Birth
                    </LoadingButton>
                  </Box>
                </form>
              </Box>
            </Box>
          </Paper>
        </Dialog>
      </>
    </PageContainer>
  );
}

const getStatusFromExtension = (resource: Appointment): OtherEHRVisitStatus | undefined => {
  const history = getVisitStatusHistory(resource);
  if (history) {
    const historySorted = [...history]
      .filter((item) => item.period.end == undefined)
      .sort((h1, h2) => {
        const start1 = h1.period.start;
        const start2 = h2.period.start;
        if (start1 && !start2) {
          return -1;
        }
        if (start2 && !start1) {
          return 1;
        }
        if (!start1 && !start2) {
          return 0;
        }
        const date1 = DateTime.fromISO(start1 as string).toMillis();
        const date2 = DateTime.fromISO(start2 as string).toMillis();
        return date1 - date2;
      });

    return historySorted.pop()?.label as OtherEHRVisitStatus;
  }
  return undefined;
};
