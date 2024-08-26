import { Box, Button, Dialog, Paper, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useCallback, useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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

const FORM_ELEMENTS_FIELDS = {
  challengeDay: { label: 'Date of birth day', name: 'challengeDay' },
  challengeMonth: { label: 'Date of birth month', name: 'challengeMonth' },
  challengeYear: { label: 'Date of birth year', name: 'challengeYear' },
};

const { challengeDay, challengeMonth, challengeYear } = FORM_ELEMENTS_FIELDS;

const ConfirmDateOfBirth = (): JSX.Element => {
  const navigate = useNavigate();
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
      label: 'Date of birth',
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
          label: "Patient's year of birth",
        },
        {
          type: 'Date Month',
          name: challengeMonth.name,
          label: "Patient's month of birth",
        },
        {
          type: 'Date Day',
          name: challengeDay.name,
          label: "Patient's day of birth",
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
  }, [formValuesCopy]);

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
      title={`Confirm ${patientInfo?.firstName ? `${patientInfo?.firstName}'s` : 'patient’s'} date of birth`}
      bgVariant={IntakeFlowPageRoute.ConfirmDateOfBirth.path}
    >
      <>
        <PageForm
          formElements={formElements}
          controlButtons={{
            submitLabel: 'Continue',
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
                Unfortunately, this patient record is not confirmed.
              </Typography>
              <Typography sx={{ mt: 2 }}>
                This date of birth{formattedDOB ? ` (${formattedDOB})` : ''} doesn’t match the selected patient profile
                {patientInfo?.firstName ? ` (${patientInfo?.firstName})` : ''}.
              </Typography>
              <Typography sx={{ mt: 1 }}>You can try again or continue and verify DOB at check-in.</Typography>
              <Box
                display="flex"
                flexDirection={{ xs: 'column', md: 'row' }}
                sx={{ justifyContent: 'space-between', mt: 4.125 }}
                gap={{ xs: 2 }}
              >
                <Button variant="outlined" onClick={handleContinueAnyway} color="secondary" size="large" type="submit">
                  Continue anyway
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setOpenModal(false)}
                  size="large"
                  type="button"
                  color="secondary"
                >
                  Try again
                </Button>
              </Box>
            </Box>
          </Paper>
        </Dialog>
        <ErrorDialog
          open={requestErrorDialogOpen}
          title="Error"
          description="An error occured. Please, try again in a moment."
          closeButtonText="Close"
          handleClose={() => setRequestErrorDialogOpen(false)}
        />
      </>
    </CustomContainer>
  );
};

export default ConfirmDateOfBirth;
