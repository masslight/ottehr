import { Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorDialog, PageForm, safelyCaptureException } from 'ui-components';
import { PatientInfo, PersonSex, getPatientInfoFullName, getSelectors, yupDateTransform } from 'utils';
import { intakeFlowPageRoute } from '../../App';
import { otherColors } from '../../IntakeThemeProvider';
import { useAppointmentStore, useAppointmentUpdate } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import { usePatientInfoStore } from '../features/patient-info';
import { useTranslation } from 'react-i18next';
import { ReasonForVisitOptions } from '../../features/patients/types';

const PatientInformation = (): JSX.Element => {
  const { t } = useTranslation();
  const { updateAppointment, appointmentUpdatingStatus } = useAppointmentUpdate();
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);
  const navigate = useNavigate();
  const [ageErrorDialogOpen, setAgeErrorDialogOpen] = useState<boolean>(false);
  const [requestErrorDialogOpen, setRequestErrorDialogOpen] = useState<boolean>(false);

  const { patientInfo: currentPatientInfo, pendingPatientInfoUpdates } = getSelectors(usePatientInfoStore, [
    'patientInfo',
    'pendingPatientInfoUpdates',
  ]);

  const patientInfo = { ...currentPatientInfo, ...pendingPatientInfoUpdates, id: currentPatientInfo.id };
  const intakeCommon = useIntakeCommonStore.getState();

  const onSubmit = async (patientInfo: PatientInfo): Promise<void> => {
    try {
      const stateInfo = { locationState: intakeCommon?.selectedLocationState };
      const { status, error, validationErrors } = await updateAppointment({ patientInfo, stateInfo });

      if (status === 'error') {
        setRequestErrorDialogOpen(true);
        error && safelyCaptureException(error);
        return;
      }

      if (status === 'validation-error') {
        if (validationErrors?.['ageOutOfRange']) {
          setAgeErrorDialogOpen(true);
          return;
        }

        if (validationErrors?.['dateOfBirthConfirmation']) {
          console.log('confirm path', validationErrors);
          navigate(intakeFlowPageRoute.TelemedConfirmDateOfBirth.path);
          return;
        }

        useIntakeCommonStore.setState({ error: t('general.errors.general') });
        console.error('unhandled validation error', validationErrors);
        return;
      }
    } catch (error) {
      console.error('unhandled update error', error);
      safelyCaptureException(error);
      setRequestErrorDialogOpen(true);
    }
  };

  useEffect(() => {
    if (appointmentID && navigate) {
      console.log('has appointment id', appointmentID);
      navigate(`/telemed/paperwork/${appointmentID}`);
    } else {
      console.log('no appointmentID');
    }
  }, [appointmentID, navigate]);

  const formattedBirthday = DateTime.fromFormat(yupDateTransform(patientInfo.dateOfBirth) || '', 'yyyy-MM-dd').toFormat(
    'MMM dd, yyyy'
  );

  return (
    <CustomContainer
      title="About the patient"
      description="We use this information to ensure we're able to provide you with care. All information is kept confidential."
    >
      {!patientInfo.newPatient && (
        <>
          <Typography variant="h3" color="secondary.main">
            {getPatientInfoFullName(patientInfo)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '14px' }} color="secondary.main">
            Birthday: {formattedBirthday || patientInfo.dateOfBirth}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '14px' }} color="secondary.main">
            Birth sex: {patientInfo.sex}
          </Typography>
          <Typography variant="body1" color={otherColors.wrongPatient} marginTop={2} marginBottom={4}>
            Wrong patient? Please{' '}
            <Link
              style={{ color: otherColors.wrongPatient }}
              to={`${intakeFlowPageRoute.TelemedSelectPatient.path}?flow=requestVisit`}
            >
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
            label: 'First name (legal)',
            placeholder: 'First name',
            defaultValue: patientInfo.firstName,
            required: patientInfo.newPatient,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Text',
            name: 'middleName',
            label: 'Middle name (legal)',
            placeholder: 'Middle name',
            defaultValue: patientInfo.middleName,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: 'Last name (legal)',
            placeholder: 'Last name',
            defaultValue: patientInfo.lastName,
            required: patientInfo.newPatient,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Text',
            name: 'chosenName',
            label: 'Chosen or preferred name (optional)',
            placeholder: 'Chosen name',
            defaultValue: patientInfo.chosenName,
          },
          {
            type: 'Date',
            name: 'dateOfBirth',
            label: "Patient's date of birth",
            defaultValue: patientInfo.dateOfBirth,
            required: patientInfo.newPatient,
            hidden: !patientInfo.newPatient,
          },
          {
            type: 'Select',
            name: 'sex',
            label: "Patient's birth sex",
            defaultValue: patientInfo.sex,
            required: true,
            hidden: !patientInfo.newPatient,
            infoTextSecondary:
              'Our care team uses this to inform treatment recommendations and share helpful information regarding potential medication side effects, as necessary.',
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
            label: 'Patient weight (lbs)',
            infoTextSecondary: 'Entering correct information in this box will help us with prescription dosing.',
            defaultValue: patientInfo.weight,
            helperText: patientInfo.newPatient
              ? undefined
              : `Weight last updated: ${
                  patientInfo.weightLastUpdated
                    ? DateTime.fromFormat(patientInfo.weightLastUpdated, 'yyyy-LL-dd').toFormat('MM/dd/yyyy')
                    : 'N/A'
                }`,
            showHelperTextIcon: false,
          },
          {
            type: 'Text',
            name: 'email',
            label: 'Email',
            format: 'Email',
            defaultValue: patientInfo.email,
            required: true,
          },
          {
            type: 'Select',
            name: 'reasonForVisit',
            label: t('aboutPatient.reasonForVisit.label'),
            defaultValue: patientInfo?.reasonForVisit,
            selectOptions: ReasonForVisitOptions.map((reason) => {
              return { value: reason, label: t(`paperworkPages.${reason}`) };
            }),
            required: true,
          },
        ]}
        controlButtons={{
          onBack: () => navigate(intakeFlowPageRoute.RequestVirtualVisit.path),
          loading: appointmentUpdatingStatus === 'pending',
          submitLabel: 'Continue',
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
      <ErrorDialog
        open={requestErrorDialogOpen}
        title="Error"
        description="An error occurred. Please, try again in a moment."
        closeButtonText="Close"
        handleClose={() => setRequestErrorDialogOpen(false)}
      />
    </CustomContainer>
  );
};

export default PatientInformation;
