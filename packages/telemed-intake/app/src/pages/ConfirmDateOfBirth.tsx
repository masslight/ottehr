import { Box, Button, Dialog, Paper, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useCallback, useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorDialog, FormInputType, PageForm, safelyCaptureException } from 'ottehr-components';
import { UpdateAppointmentResponse, getSelectors, yupDateTransform } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import {
  useAppointmentStore,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
} from '../features/appointments';
import { CustomContainer } from '../features/common';
import { useGetPaperwork, usePaperworkStore } from '../features/paperwork';
import { usePatientInfoStore } from '../features/patient-info';
import { useZapEHRAPIClient } from '../utils';

const ConfirmDateOfBirth = (): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const apiClient = useZapEHRAPIClient();
  const updateAppointment = useUpdateAppointmentMutation();
  const [requestErrorDialogOpen, setRequestErrorDialogOpen] = useState<boolean>(false);
  const createAppointment = useCreateAppointmentMutation();
  const [getPaperworkEnabled, setGetPaperworkEnabled] = useState<boolean>(false);
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);
  const { patchCompletedPaperwork, setQuestions } = getSelectors(usePaperworkStore, [
    'patchCompletedPaperwork',
    'setQuestions',
  ]);

  const FORM_ELEMENTS_FIELDS = {
    challengeDay: {
      label: t('confirmDateOfBirth.formElement.labels.challengeDay'),
      name: 'challengeDay',
    },
    challengeMonth: {
      label: t('confirmDateOfBirth.formElement.labels.challengeMonth'),
      name: 'challengeMonth',
    },
    challengeYear: {
      label: t('confirmDateOfBirth.formElement.labels.challengeYear'),
      name: 'challengeYear',
    },
  };

  const { challengeDay, challengeMonth, challengeYear } = FORM_ELEMENTS_FIELDS;

  const getPaperworkQuery = useGetPaperwork(
    (data) => {
      patchCompletedPaperwork(data.paperwork);
      setQuestions(data.questions);
      updateResourcesOrNavigateNext();
    },
    { staleTime: 0, enabled: getPaperworkEnabled },
  );

  const [openModal, setOpenModal] = useState(false);

  const { pendingPatientInfoUpdates, patientInfo: currentPatientInfo } = getSelectors(usePatientInfoStore, [
    'pendingPatientInfoUpdates',
    'patientInfo',
  ]);

  const patientInfo = { ...currentPatientInfo, ...pendingPatientInfoUpdates };

  const [formValuesCopy, setFormValuesCopy] = useState<FieldValues | undefined>();

  const formElements: FormInputType[] = [
    {
      type: 'Date',
      name: 'challengeDateOfBirth',
      label: t('confirmDateOfBirth.formElement.labels.challengeDateOfBirth'),
      required: true,
      fieldMap: {
        day: challengeDay.name,
        month: challengeMonth.name,
        year: challengeYear.name,
      },
      fields: [
        {
          type: 'Date Year',
          name: challengeYear.name,
          label: challengeYear.label,
        },
        {
          type: 'Date Month',
          name: challengeMonth.name,
          label: challengeMonth.label,
        },
        {
          type: 'Date Day',
          name: challengeDay.name,
          label: challengeDay.label,
        },
      ],
    },
  ];

  const onFormValuesChange = useCallback((formValues: FieldValues): void => {
    setFormValuesCopy(formValues);
  }, []);

  const formattedDOB: string | undefined = useMemo(() => {
    const month = formValuesCopy?.[challengeMonth.name];
    const day = formValuesCopy?.[challengeDay.name];
    const year = formValuesCopy?.[challengeYear.name];

    if (month && day && year) {
      return `${month}/${day}/${year}`;
    }
    return undefined;
  }, [challengeDay.name, challengeMonth.name, challengeYear.name, formValuesCopy]);

  const createOrUpdateAppointment = (unconfirmedDateOfBirth = false): void => {
    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }

    // if we have appointment ID here - means that the appointment was already created
    // either before or in this request a visit flow, so we can just update the existing appointment
    if (appointmentID) {
      updateAppointment.mutate(
        { appointmentID: appointmentID, apiClient, patientInfo },
        {
          onSuccess: (response: UpdateAppointmentResponse) => {
            console.log('Appointment updated successfully', response);
            usePatientInfoStore.setState(() => ({
              patientInfo: patientInfo,
              pendingPatientInfoUpdates: undefined,
            }));
            // just for the navigateNext to have the latest state values
            void Promise.resolve().then(() => updateResourcesOrNavigateNext());
          },
          onError: (error) => {
            setRequestErrorDialogOpen(true);
            safelyCaptureException(error);
          },
        },
      );
    } else {
      createAppointment.mutate(
        { apiClient, patientInfo, unconfirmedDateOfBirth },
        {
          onSuccess: async (response) => {
            useAppointmentStore.setState(() => ({ appointmentID: response.appointmentId }));
            const newPatientInfo = { ...patientInfo, id: response.patientId || patientInfo.id };
            usePatientInfoStore.setState(() => ({
              pendingPatientInfoUpdates: undefined,
              patientInfo: newPatientInfo,
            }));

            // just for the navigateNext to have the latest state values
            void Promise.resolve().then(() => updateResourcesOrNavigateNext());
          },
          onError: (error) => {
            // setRequestErrorDialogOpen(true);
            safelyCaptureException(error);
          },
        },
      );
    }
  };

  const handleSubmit = (): void => {
    const firstDate = DateTime.fromFormat(yupDateTransform(formattedDOB) || '', 'yyyy-MM-dd');
    const secondDate = DateTime.fromFormat(yupDateTransform(patientInfo.dateOfBirth) || '', 'yyyy-MM-dd');
    if (!firstDate.equals(secondDate)) {
      setOpenModal(true);
    } else {
      updateResourcesOrNavigateNext();
    }
  };

  const handleContinueAnyway = (): void => {
    updateResourcesOrNavigateNext();
    setOpenModal(false);
  };

  const updateResourcesOrNavigateNext = (): void => {
    const { pendingPatientInfoUpdates } = usePatientInfoStore.getState();
    const { appointmentID } = useAppointmentStore.getState();
    const { paperworkQuestions } = usePaperworkStore.getState();
    if (pendingPatientInfoUpdates || !appointmentID) {
      createOrUpdateAppointment(formattedDOB !== patientInfo?.dateOfBirth);
      return;
    }

    if (getPaperworkEnabled && paperworkQuestions && paperworkQuestions.length > 0) {
      navigate(`/paperwork/${paperworkQuestions?.[0].slug}`);
    } else {
      setGetPaperworkEnabled(true);
    }
  };

  return (
    <CustomContainer
      title={t('confirmDateOfBirth.title', {
        patientFirstName: patientInfo?.firstName ?? t('confirmDateOfBirth.patientFirstNameFallback'),
      })}
      bgVariant={IntakeFlowPageRoute.ConfirmDateOfBirth.path}
    >
      <>
        <PageForm
          formElements={formElements}
          controlButtons={{
            submitLabel: t('general.button.continue'),
            loading: getPaperworkQuery.isLoading || createAppointment.isLoading,
          }}
          onSubmit={handleSubmit}
          onFormValuesChange={onFormValuesChange}
        />
        <Dialog
          open={openModal}
          onClose={() => setOpenModal(false)}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Paper>
            <Box sx={{ m: { md: 5, xs: 3 }, maxWidth: 'sm' }}>
              <Typography sx={{ width: '100%' }} variant="h2" color="primary.main">
                {t('confirmDateOfBirth.notConfirmed')}
              </Typography>
              <Typography sx={{ mt: 2 }}>
                {t('dateOfBirthErrorMessage', {
                  formattedDOB: formattedDOB ? `(${formattedDOB})` : '',
                  patientFirstName: patientInfo?.firstName ? `(${patientInfo?.firstName})` : '',
                })}
              </Typography>
              <Typography sx={{ mt: 1 }}>{t('confirmDateOfBirth.tryAgain')}</Typography>
              <Box
                display="flex"
                flexDirection={{ xs: 'column', md: 'row' }}
                sx={{ justifyContent: 'space-between', mt: 4.125 }}
                gap={{ xs: 2 }}
              >
                <Button variant="outlined" onClick={handleContinueAnyway} color="secondary" size="large" type="submit">
                  {t('general.button.continueAnyway')}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setOpenModal(false)}
                  size="large"
                  type="button"
                  color="secondary"
                >
                  {t('general.button.tryAgain')}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Dialog>
        <ErrorDialog
          open={requestErrorDialogOpen}
          title={t('confirmDateOfBirth.requestError.title')}
          description={t('confirmDateOfBirth.requestError.description')}
          closeButtonText={t('general.button.close')}
          handleClose={() => setRequestErrorDialogOpen(false)}
        />
      </>
    </CustomContainer>
  );
};

export default ConfirmDateOfBirth;
