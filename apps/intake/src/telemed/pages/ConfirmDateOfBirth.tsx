import { Box, Button, Dialog, Paper, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ErrorDialog, PageForm, safelyCaptureException } from 'ui-components';
import { getPatientChosenName, getSelectors, removeTimeFromDate, yupDateTransform } from 'utils';
import { useAppointmentStore, useAppointmentUpdate } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import { usePatientInfoStore } from '../features/patient-info';
import { getPromiseWithResolvers } from '../utils';

const FORM_ELEMENTS_FIELDS = {
  challengeDay: { label: 'Date of birth day', name: 'challengeDay' },
  challengeMonth: { label: 'Date of birth month', name: 'challengeMonth' },
  challengeYear: { label: 'Date of birth year', name: 'challengeYear' },
};

type UserAnswer = 'try-again' | 'continue-anyway';

type UserAnswerPromise = {
  promise: Promise<UserAnswer>;
  resolve: (answer: UserAnswer) => void;
  reject: (error: any) => void;
};

const { challengeDay, challengeMonth, challengeYear } = FORM_ELEMENTS_FIELDS;

const ConfirmDateOfBirth = (): JSX.Element => {
  const navigate = useNavigate();
  const [requestErrorDialogOpen, setRequestErrorDialogOpen] = useState<boolean>(false);
  const { updateAppointment, appointmentUpdatingStatus } = useAppointmentUpdate();
  const userAnswerRef = useRef<UserAnswerPromise>();

  //const getPaperworkQuery = useGetPaperwork(undefined, { enabled: false });
  const [openModal, setOpenModal] = useState(false);

  const { pendingPatientInfoUpdates, patientInfo: currentPatientInfo } = getSelectors(usePatientInfoStore, [
    'pendingPatientInfoUpdates',
    'patientInfo',
  ]);

  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);

  const patientInfo = { ...currentPatientInfo, ...pendingPatientInfoUpdates };
  const stateInfo = { locationState: useIntakeCommonStore((state) => state.selectedLocationState) };
  const [formValuesCopy, setFormValuesCopy] = useState<FieldValues | undefined>();

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

  const handleSubmit = async (): Promise<void> => {
    const firstDate = DateTime.fromFormat(yupDateTransform(formattedDOB) || '', 'yyyy-MM-dd');
    const secondDate = DateTime.fromFormat(yupDateTransform(patientInfo.dateOfBirth) || '', 'yyyy-MM-dd');

    if (!firstDate.equals(secondDate)) {
      setOpenModal(true);
      userAnswerRef.current = getPromiseWithResolvers<UserAnswer>();
      const answer = await userAnswerRef.current?.promise;

      if (answer === 'try-again') {
        return;
      }
    }

    const { status, error } = await updateAppointment({
      patientInfo,
      stateInfo,
      unconfirmedDateOfBirth: removeTimeFromDate(String(firstDate)),
      isPatientConfirmDateOfBirth: true,
    });

    if (status === 'error' || status === 'validation-error') {
      console.error('update skipped by status:', status);
      setRequestErrorDialogOpen(true);
      error && safelyCaptureException(error);
      return;
    }
  };

  const handleContinueAnyway = async (): Promise<void> => {
    setOpenModal(false);
    userAnswerRef.current?.resolve?.('continue-anyway');
  };

  useEffect(() => {
    if (appointmentID && navigate) {
      console.log('has appointment id', appointmentID);
      navigate(`/telemed/paperwork/${appointmentID}`);
    } else {
      console.log('no appointmentID');
    }
  }, [appointmentID, navigate]);

  return (
    <CustomContainer title={`Confirm ${getPatientChosenName(patientInfo, true)}'s date of birth`}>
      <>
        <PageForm
          formElements={[
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
          ]}
          controlButtons={{
            submitLabel: 'Continue',
            loading: appointmentUpdatingStatus === 'pending',
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
                  onClick={() => {
                    setOpenModal(false);
                    userAnswerRef.current?.resolve?.('try-again');
                  }}
                  color="secondary"
                  size="large"
                  type="button"
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
