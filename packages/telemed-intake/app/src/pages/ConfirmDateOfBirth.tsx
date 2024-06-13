import { Box, Button, Dialog, Paper, Typography } from '@mui/material';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { FormInputType, PageForm, safelyCaptureException } from 'ottehr-components';
import { useNavigate } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import { usePatientInfoStore } from '../features/patient-info';
import { getSelectors } from 'ottehr-utils';
import { FieldValues } from 'react-hook-form';
import { useCreateAppointmentMutation, useAppointmentStore } from '../features/appointments';
import { useZapEHRAPIClient } from '../utils';
import { useFilesStore } from '../features/files';
import { useGetPaperwork, usePaperworkStore } from '../features/paperwork';

const FORM_ELEMENTS_FIELDS = {
  challengeDay: { label: 'Date of birth day', name: 'challengeDay' },
  challengeMonth: { label: 'Date of birth month', name: 'challengeMonth' },
  challengeYear: { label: 'Date of birth year', name: 'challengeYear' },
};

const { challengeDay, challengeMonth, challengeYear } = FORM_ELEMENTS_FIELDS;

const ConfirmDateOfBirth = (): JSX.Element => {
  const navigate = useNavigate();
  const apiClient = useZapEHRAPIClient();
  const createAppointment = useCreateAppointmentMutation();
  const [getPaperworkEnabled, setGetPaperworkEnabled] = useState<boolean>(false);
  const paperworkState = getSelectors(usePaperworkStore, ['patchCompletedPaperwork', 'setQuestions']);

  const getPaperworkQuery = useGetPaperwork(
    (data) => {
      paperworkState.patchCompletedPaperwork(data.paperwork);
      paperworkState.setQuestions(data.questions);
      useFilesStore.setState({ fileURLs: data.files });
      navigate(`/paperwork/${data.questions[0].slug}`);
    },
    { staleTime: 0, enabled: getPaperworkEnabled },
  );

  const [openModal, setOpenModal] = useState(false);

  const { patientInfo } = getSelectors(usePatientInfoStore, ['patientInfo']);

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

  const handleAppointmentCreation = (unconfirmedDateOfBirth = false): void => {
    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }

    const params = {
      apiClient,
      ...(unconfirmedDateOfBirth && { unconfirmedDateOfBirth: 'true' }),
    };

    createAppointment.mutate(params, {
      onSuccess: (response) => {
        useAppointmentStore.setState(() => ({ appointmentID: response.appointmentId }));
        if (response.fhirPatientId) {
          usePatientInfoStore.setState((state) => ({
            patientInfo: { ...state.patientInfo, id: response.fhirPatientId },
          }));
        }
        setGetPaperworkEnabled(true);
      },
      onError: (error) => {
        safelyCaptureException(error);
      },
    });
  };

  const handleSubmit = (): void => {
    if (formattedDOB !== patientInfo?.dateOfBirth) {
      setOpenModal(true);
    } else {
      handleAppointmentCreation();
    }
  };

  const handleContinueAnyway = (): void => {
    handleAppointmentCreation(true);
    setOpenModal(false);
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
            <Box sx={{ m: 5, maxWidth: 'sm' }}>
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
              >
                <Button variant="outlined" onClick={handleContinueAnyway} color="primary" size="large" type="submit">
                  Continue anyway
                </Button>
                <Button variant="contained" onClick={() => setOpenModal(false)} size="large" type="button">
                  Try again
                </Button>
              </Box>
            </Box>
          </Paper>
        </Dialog>
      </>
    </CustomContainer>
  );
};

export default ConfirmDateOfBirth;
