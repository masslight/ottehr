import { Typography } from '@mui/material';
import { DateTime } from 'luxon';
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useZambdaClient, ErrorDialog, PageForm } from 'ui-components';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import zapehrApi from '../api/zapehrApi';
import { CustomContainer } from '../components';
import { ageIsInRange, ymdStringFromDateString, yupDateTransform } from '../helpers';
import { createAppointmentAndUpdateState } from '../helpers/createAppointmentAndUpdateState';
import { safelyCaptureException } from '../helpers/sentry';
import {
  updateCompletedPaperwork,
  updateFileURLs,
  updatePaperworkQuestions,
  updatePatient,
} from '../store/IntakeActions';
import { IntakeDataContext } from '../store/IntakeContext';
import { PatientInfo, VisitType } from '../store/types';
import { ReasonForVisitOptions } from '../types/types';

const PatientInformation = (): JSX.Element => {
  const navigate = useNavigate();
  const [ageErrorDialogOpen, setAgeErrorDialogOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const { state, dispatch } = useContext(IntakeDataContext);
  const zambdaClient = useZambdaClient({ tokenless: false });

  useEffect(() => {
    mixpanel.track('Patient Information');
  }, []);

  const onSubmit = async (data: PatientInfo): Promise<void> => {
    setLoading(true);
    // Store DOB in yyyy-mm-dd format for backend validation
    const dateOfBirth = ymdStringFromDateString(data.dateOfBirth || state.patientInfo?.dateOfBirth || '');
    data.dateOfBirth = dateOfBirth || 'Unknown';

    if (!ageIsInRange(dateOfBirth ?? '')) {
      setAgeErrorDialogOpen(true);
      setLoading(false);
      return;
    }

    const paperwork: any = {};
    if (data.emailUser === 'Patient') {
      paperwork['patient-email'] = data.email;
    }
    if (data.emailUser === 'Parent/Guardian') {
      paperwork['guardian-email'] = data.email;
    }
    updateCompletedPaperwork(paperwork, dispatch);

    if (state.patientInfo) {
      state.patientInfo.id = state.patientInfo.id === 'new-patient' ? undefined : state.patientInfo.id;
      data.newPatient = state.patientInfo.newPatient;
    }
    const fullPatientInfo = { ...state.patientInfo, ...data };
    updatePatient(fullPatientInfo, dispatch);
    if (!zambdaClient) {
      throw new Error('zambdaClient is not defined');
    }

    if (state.visitType === VisitType.WalkIn) {
      let appointment;
      try {
        appointment = await createAppointmentAndUpdateState(zambdaClient, fullPatientInfo, state, dispatch);
      } catch (err) {
        safelyCaptureException(err);
        setLoading(false);
        throw err;
      }

      const paperworkResponse = await zapehrApi.getPaperwork(
        zambdaClient,
        {
          appointmentID: appointment,
        },
        dispatch,
      );

      updatePaperworkQuestions(paperworkResponse.questions, dispatch);
      updateCompletedPaperwork(paperworkResponse.paperwork, dispatch);
      paperworkResponse.files && updateFileURLs(paperworkResponse.files, dispatch);
      setLoading(false);
      navigate(`/paperwork/${paperworkResponse.questions[0].slug}`);
    } else if (state.visitType === VisitType.PreBook) {
      setLoading(false);
      navigate(IntakeFlowPageRoute.Review.path);
    }
    setLoading(false);
  };

  const formattedBirthday = DateTime.fromFormat(
    yupDateTransform(state.unconfirmedDateOfBirth ? state.unconfirmedDateOfBirth : state.patientInfo?.dateOfBirth) ||
      '',
    'yyyy-MM-dd',
  ).toFormat('MMMM dd, yyyy');

  return (
    <CustomContainer
      title="About the patient"
      description="We use this information to ensure we're able to provide you with care. All information is kept confidential."
      bgVariant={IntakeFlowPageRoute.PatientInformation.path}
    >
      {!state.patientInfo?.newPatient && (
        <>
          <Typography variant="h3" color="secondary.main"></Typography>
          <Typography variant="body2" sx={{ fontSize: '14px' }} color="secondary.main">
            Birthday: {formattedBirthday || state.patientInfo?.dateOfBirth}
          </Typography>
          <Typography variant="body1" color={otherColors.wrongPatient} marginTop={2} marginBottom={4}>
            Wrong patient? Please{' '}
            <Link style={{ color: otherColors.wrongPatient }} to={IntakeFlowPageRoute.WelcomeBack.path}>
              go back
            </Link>{' '}
            for a new patient or different existing patient record.
          </Typography>
        </>
      )}
      <PageForm
        formElements={[
          {
            type: 'Text',
            name: 'firstName',
            label: "Patient's legal first name",
            placeholder: 'First name',
            defaultValue: state.patientInfo?.firstName,
            required: state.patientInfo?.newPatient,
            width: 6,
            hidden: !state.patientInfo?.newPatient,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: "Patient's legal last name",
            placeholder: 'Last name',
            defaultValue: state.patientInfo?.lastName,
            required: state.patientInfo?.newPatient,
            width: 6,
            hidden: !state.patientInfo?.newPatient,
          },
          {
            type: 'Date',
            name: 'dateOfBirth',
            label: "Patient's date of birth",
            defaultValue: state.patientInfo?.dateOfBirth,
            required: state.patientInfo?.newPatient,
            hidden: !state.patientInfo?.newPatient,
          },
          {
            type: 'Text',
            name: 'email',
            label: 'Email',
            format: 'Email',
            defaultValue: state.patientInfo?.email,
            required: true,
          },
          {
            type: 'Radio List',
            name: 'emailUser',
            label: 'This email belongs to',
            defaultValue: state.patientInfo?.emailUser || 'Parent/Guardian',
            required: true,
            radioOptions: [
              {
                label: 'Parent/Guardian',
                value: 'Parent/Guardian',
              },
              {
                label: 'Patient',
                value: 'Patient',
              },
            ],
          },
          {
            type: 'Free Select',
            name: 'reasonForVisit',
            label: 'Reason for visit',
            placeholder: 'Type whatever you want or select...',
            defaultValue: state.patientInfo?.reasonForVisit,
            required: true,
            multiline: true,
            minRows: 4,
            characterLimit: 160,
            freeSelectOptions: ReasonForVisitOptions,
          },
        ]}
        controlButtons={{
          loading: loading,
          submitLabel: state.visitType === VisitType.PreBook ? 'Continue' : 'Complete & Check-in',
        }}
        onSubmit={onSubmit}
      />
      <ErrorDialog
        open={ageErrorDialogOpen}
        title="Age not in range"
        description="These services are only available for patients between the ages of 0 and 26."
        closeButtonText="Close"
        handleClose={() => setAgeErrorDialogOpen(false)}
      />
    </CustomContainer>
  );
};

export default PatientInformation;
