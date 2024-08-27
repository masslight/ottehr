import { Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useTranslation } from 'react-i18next';
import { ErrorDialog, PageForm, safelyCaptureException } from 'ottehr-components';
import {
  PatientInfo,
  PersonSex,
  UpdateAppointmentResponse,
  ageIsInRange,
  getPatientInfoFullName,
  getSelectors,
  isoStringFromMDYString,
  yupDateTransform,
} from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import {
  useAppointmentStore,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
} from '../features/appointments';
import { CustomContainer } from '../features/common';
import { useFilesStore } from '../features/files';
import { useGetPaperwork, usePaperworkStore } from '../features/paperwork';
import { usePatientInfoStore } from '../features/patient-info';
import { MAXIMUM_AGE, MINIMUM_AGE, useZapEHRAPIClient } from '../utils';

const UPDATEABLE_PATIENT_INFO_FIELDS: (keyof Omit<PatientInfo, 'id'>)[] = [
  'firstName',
  'lastName',
  'middleName',
  'chosenName',
  'dateOfBirth',
  'sex',
  'weight',
  'email',
  'emailUser',
];

const isPatientInfoEqual = (firstInfo: PatientInfo, newInfo: PatientInfo): boolean => {
  for (const key of UPDATEABLE_PATIENT_INFO_FIELDS) {
    if (key === 'dateOfBirth' || key === 'weightLastUpdated') {
      const firstDate = DateTime.fromFormat(yupDateTransform(firstInfo[key]) || '', 'yyyy-MM-dd');
      const secondDate = DateTime.fromFormat(yupDateTransform(newInfo[key]) || '', 'yyyy-MM-dd');
      if (!firstDate.equals(secondDate)) return false;
    }
    if (firstInfo[key] !== newInfo[key]) return false;
  }

  return true;
};

const createPatientInfoWithChangedFields = (source: PatientInfo, newInfo: Omit<PatientInfo, 'id'>): PatientInfo => {
  const newPatienInfo = { ...source };
  for (const key of UPDATEABLE_PATIENT_INFO_FIELDS) {
    newPatienInfo[key] = newInfo[key] as any;
  }
  return newPatienInfo;
};

const PatientInformation = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const [getPaperworkEnabled, setGetPaperworkEnabled] = useState(false);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const [ageErrorDialogOpen, setAgeErrorDialogOpen] = useState<boolean>(false);
  const [requestErrorDialogOpen, setRequestErrorDialogOpen] = useState<boolean>(false);
  const { patientInfo: currentPatientInfo, pendingPatientInfoUpdates } = getSelectors(usePatientInfoStore, [
    'patientInfo',
    'pendingPatientInfoUpdates',
  ]);
  const patientInfo = { ...currentPatientInfo, ...pendingPatientInfoUpdates, id: currentPatientInfo.id };
  const initialPatientInfoRef = useRef(currentPatientInfo);
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);
  const { patchCompletedPaperwork, setQuestions } = getSelectors(usePaperworkStore, [
    'patchCompletedPaperwork',
    'setQuestions',
  ]);

  const createAppointment = useCreateAppointmentMutation();
  const updateAppointment = useUpdateAppointmentMutation();
  const getPaperworkQuery = useGetPaperwork(
    (data) => {
      const paperwork: any = {};
      if (patientInfo.emailUser === 'Patient') {
        paperwork['patient-email'] = patientInfo.email;
      }
      if (patientInfo.emailUser === 'Parent/Guardian') {
        paperwork['guardian-email'] = patientInfo.email;
      }

      patchCompletedPaperwork({ ...data.paperwork, ...paperwork });
      setQuestions(data.questions);
      useFilesStore.setState({ fileURLs: data.files });
      navigate(`/paperwork/${data.questions[0].slug}`);
    },
    {
      staleTime: 0,
      enabled: getPaperworkEnabled,
      onError: (error) => {
        safelyCaptureException(error);
        setRequestErrorDialogOpen(true);
      },
    },
  );

  const { getIdTokenClaims } = useAuth0();
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const getUserEmail = async (): Promise<void> => {
      try {
        const idTokenClaims = await getIdTokenClaims();
        setUserEmail(idTokenClaims?.email);
      } catch (error) {
        console.error('Error getting id token claims:', error);
      }
    };

    if (patientInfo.email === undefined) {
      void getUserEmail();
    }
    setIsLoading(false);
  }, [getIdTokenClaims, patientInfo.email]);

  // useEffect(() => {
  //   mixpanel.track('Patient Information page opened');
  // }, []);

  const onSubmit = async (data: PatientInfo): Promise<void> => {
    // Store DOB in yyyy-mm-dd format for backend validation
    const dateOfBirth = isoStringFromMDYString(yupDateTransform(data.dateOfBirth || patientInfo.dateOfBirth || ''));
    data.dateOfBirth = dateOfBirth || 'Unknown';

    if (!ageIsInRange(dateOfBirth ?? '', MINIMUM_AGE, MAXIMUM_AGE).result) {
      setAgeErrorDialogOpen(true);
      return;
    }

    if (!patientInfo.id) {
      data.newPatient = patientInfo.newPatient;
    }

    let pendingUpdates: PatientInfo | undefined = undefined;

    if (!isPatientInfoEqual(initialPatientInfoRef.current, data)) {
      pendingUpdates = createPatientInfoWithChangedFields(patientInfo, data);
      usePatientInfoStore.setState(() => ({
        pendingPatientInfoUpdates: pendingUpdates,
      }));
    }

    // if it's a known patient (and it's not the case when
    // patientInfo has 'id' property that was already set by create-appointment success callback)
    if (patientInfo.id && !data.newPatient && !appointmentID) {
      navigate(IntakeFlowPageRoute.ConfirmDateOfBirth.path);
      return;
    }

    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }

    // if we have appointment ID here - means that the appointment was already created
    // either before or in this request a visit flow, so we can just update the existing appointment
    // if some patient info data changed
    if (appointmentID) {
      if (pendingUpdates) {
        updateAppointment.mutate(
          { appointmentID: appointmentID, apiClient, patientInfo: pendingUpdates },
          {
            onSuccess: (response: UpdateAppointmentResponse) => {
              console.log('Appointment updated successfully', response);
              usePatientInfoStore.setState(() => ({
                patientInfo: pendingUpdates,
                pendingPatientInfoUpdates: undefined,
              }));
              initialPatientInfoRef.current = { ...pendingUpdates };
              updateResourcesOrNavigateNext();
            },
            onError: (error) => {
              setRequestErrorDialogOpen(true);
              safelyCaptureException(error);
            },
          },
        );
      } else {
        updateResourcesOrNavigateNext();
      }
    } else {
      if (!pendingUpdates) {
        console.error('No pending patientInfo updates, something went wrong');
        return;
      }
      createAppointment.mutate(
        { apiClient, patientInfo: pendingUpdates },
        {
          onSuccess: async (response) => {
            useAppointmentStore.setState(() => ({ appointmentID: response.appointmentId }));
            const newPatientInfo = createPatientInfoWithChangedFields(
              { ...patientInfo, id: response.patientId || patientInfo.id },
              data,
            );
            usePatientInfoStore.setState(() => ({
              pendingPatientInfoUpdates: undefined,
              patientInfo: newPatientInfo,
            }));
            initialPatientInfoRef.current = newPatientInfo;
            updateResourcesOrNavigateNext();
          },
          onError: (error) => {
            setRequestErrorDialogOpen(true);
            safelyCaptureException(error);
          },
        },
      );
    }
  };

  const updateResourcesOrNavigateNext = (): void => {
    const { paperworkQuestions } = usePaperworkStore.getState();
    // if paperwork was loaded already - just proceed to the next page
    if (paperworkQuestions && paperworkQuestions.length > 0) {
      navigate(`/paperwork/${paperworkQuestions[0].slug}`);
    } else {
      setGetPaperworkEnabled(true);
    }
  };

  const formattedBirthday = DateTime.fromFormat(yupDateTransform(patientInfo.dateOfBirth) || '', 'yyyy-MM-dd').toFormat(
    'MMM dd, yyyy',
  );

  if (isLoading) {
    return <></>;
  }

  return (
    <CustomContainer
      title={t('patientInfo.title')}
      description={t('patientInfo.description')}
      bgVariant={IntakeFlowPageRoute.PatientInformation.path}
    >
      {!patientInfo.newPatient && (
        <>
          <Typography variant="h3" color="primary.main">
            {getPatientInfoFullName(patientInfo)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '14px' }} color="primary.main">
            {t('general.patientBirthday', { formattedPatientBirthDay: formattedBirthday || patientInfo.dateOfBirth })}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '14px' }} color="primary.main">
            {t('patientInfo.birthSex', { birthSex: patientInfo.sex })}
          </Typography>
          <Typography variant="body1" color={otherColors.wrongPatient} marginTop={2} marginBottom={4}>
            {t('patientInfo.wrongPatient')}
            <Link
              style={{ color: otherColors.wrongPatient }}
              to={`${IntakeFlowPageRoute.SelectPatient.path}?flow=requestVisit`}
            >
              {t('patientInfo.wrongPatientGoBack')}
            </Link>{' '}
            {t('patientInfo.wrongPatientGoBackFor')}
          </Typography>
        </>
      )}
      <PageForm
        formElements={[
          {
            type: 'Text',
            name: 'firstName',
            label: t('patientInfo.formElement.labels.firstName'),
            placeholder: t('patientInfo.formElement.placeholders.firstName'),
            defaultValue: patientInfo.firstName,
            required: patientInfo.newPatient,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Text',
            name: 'middleName',
            label: t('patientInfo.formElement.labels.middleName'),
            placeholder: t('patientInfo.formElement.placeholders.middleName'),
            defaultValue: patientInfo.middleName,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: t('patientInfo.formElement.labels.lastName'),
            placeholder: t('patientInfo.formElement.placeholders.lastName'),
            defaultValue: patientInfo.lastName,
            required: patientInfo.newPatient,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Text',
            name: 'chosenName',
            label: t('patientInfo.formElement.labels.chosenName'),
            placeholder: t('patientInfo.formElement.placeholders.chosenName'),
            defaultValue: patientInfo.chosenName,
          },
          {
            type: 'Date',
            name: 'dateOfBirth',
            label: t('patientInfo.formElement.labels.dateOfBirth'),
            defaultValue: patientInfo.dateOfBirth,
            required: patientInfo.newPatient,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Select',
            name: 'sex',
            label: t('patientInfo.formElement.labels.sex'),
            defaultValue: patientInfo.sex,
            required: true,
            hidden: !patientInfo.newPatient,
            infoTextSecondary: t('patientInfo.formElement.infoTexts.sex'),
            selectOptions: Object.entries(PersonSex).map(([key, value]) => {
              return {
                label: key,
                value: value,
              };
            }),
          },
          {
            type: 'Text',
            format: 'Decimal',
            name: 'weight',
            label: t('patientInfo.formElement.labels.weight'),
            infoTextSecondary: t('patientInfo.formElement.infoTexts.weight'),
            defaultValue: patientInfo.weight,
            helperText: patientInfo.newPatient
              ? undefined
              : t('patientInfo.formElement.helperTexts.weight', {
                  lastUpdated: patientInfo.weightLastUpdated
                    ? DateTime.fromFormat(patientInfo.weightLastUpdated, 'yyyy-LL-dd').toFormat('MM/dd/yyyy')
                    : 'N/A',
                }),
            showHelperTextIcon: false,
          },
          {
            type: 'Text',
            name: 'email',
            label: t('patientInfo.formElement.labels.email'),
            format: 'Email',
            defaultValue: patientInfo.email ?? userEmail,
            required: true,
          },
          {
            type: 'Radio List',
            name: 'emailUser',
            label: t('patientInfo.formElement.labels.emailOwner'),
            defaultValue: patientInfo.emailUser || t('patientInfo.formElement.labels.emailOwnerParent'),
            required: true,
            radioOptions: [
              {
                label: t('patientInfo.formElement.labels.emailOwnerParent'),
                value: t('patientInfo.formElement.labels.emailOwnerParent'),
              },
              {
                label: t('patientInfo.formElement.labels.emailOwnerPatient'),
                value: t('patientInfo.formElement.labels.emailOwnerPatient'),
              },
            ],
          },
        ]}
        controlButtons={{
          onBack: () => navigate(`${IntakeFlowPageRoute.SelectPatient.path}?flow=requestVisit`),
          loading: createAppointment.isLoading || getPaperworkQuery.isLoading || updateAppointment.isLoading,
          submitLabel: t('general.button.continue'),
        }}
        onSubmit={onSubmit}
      />
      <ErrorDialog
        open={ageErrorDialogOpen}
        title={t('patientInfo.ageError.title')}
        description={t('patientInfo.ageError.description')}
        closeButtonText={t('general.button.close')}
        handleClose={() => setAgeErrorDialogOpen(false)}
      />
      <ErrorDialog
        open={requestErrorDialogOpen}
        title={t('patientInfo.requestError.title')}
        description={t('patientInfo.requestError.description')}
        closeButtonText={t('general.button.close')}
        handleClose={() => setRequestErrorDialogOpen(false)}
      />
    </CustomContainer>
  );
};

export default PatientInformation;
