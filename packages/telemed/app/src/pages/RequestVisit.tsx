import { DateTime } from 'luxon';
import { FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { PageForm } from 'ottehr-components';
import { getSelectors } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { CustomContainer } from '../features/common';
import { usePatientInfoStore } from '../features/patient-info';
import { usePatientsStore } from '../features/patients';

const FORM_PATIENT_ID_ELEMENT_BASE = {
  name: 'patientId',
  label: 'Select patient',
  defaultValue: 'new-patient',
  required: true,
};

const DIFFERENT_FAMILY_MEMBER_DATA = {
  label: 'Different family member',
  description: 'Select this option if this reservation is for a different family member',
  value: 'new-patient',
  color: otherColors.lightPurpleAlt,
};

const RequestVisit = (): JSX.Element => {
  const { patientInfo: currentPatientInfo } = usePatientInfoStore.getState();
  const navigate = useNavigate();

  const patientsStore = getSelectors(usePatientsStore, ['patients']);

  const onSubmit = (data: FieldValues): void => {
    let foundPatient = false;
    const { patientInfo: currentPatientInfo, setNewPatient } = usePatientInfoStore.getState();

    if (currentPatientInfo.id !== data.patientId) {
      patientsStore.patients &&
        patientsStore.patients.forEach(async (patient) => {
          if (patient.id === data.patientId) {
            foundPatient = true;
            usePatientInfoStore.setState(() => ({
              patientInfo: {
                id: patient.id,
                newPatient: false,
                firstName: patient.firstName,
                lastName: patient.lastName,
                dateOfBirth: DateTime.fromISO(patient.dateOfBirth || '').toString(),
                sex: patient.sex,
                reasonForVisit: currentPatientInfo?.reasonForVisit,
                email: patient.email,
                emailUser: patient.emailUser,
              },
            }));
          }
        });
      if (!foundPatient) {
        setNewPatient();
      }
    }

    navigate(IntakeFlowPageRoute.PatientInformation.path);
  };

  const onBack = (): void => {
    navigate(IntakeFlowPageRoute.Homepage.path);
  };

  return (
    <CustomContainer title="Select patient" description="" bgVariant={IntakeFlowPageRoute.Homepage.path}>
      <PageForm
        formElements={[
          {
            type: 'Radio',
            ...FORM_PATIENT_ID_ELEMENT_BASE,
            defaultValue: currentPatientInfo.id || FORM_PATIENT_ID_ELEMENT_BASE.defaultValue,
            radioOptions: (patientsStore.patients || [])
              .map((patient) => {
                if (!patient.id) {
                  throw new Error('Patient id is not defined');
                }
                return {
                  label: `${patient.firstName} ${patient.lastName}`,
                  description: `Birthday: ${DateTime.fromFormat(patient.dateOfBirth || '', 'yyyy-MM-dd').toFormat(
                    'MMMM dd, yyyy',
                  )}`,
                  value: patient.id,
                  color: otherColors.lightPurpleAlt,
                };
              })
              .concat(DIFFERENT_FAMILY_MEMBER_DATA),
          },
        ]}
        onSubmit={onSubmit}
        controlButtons={{ onBack }}
      />
    </CustomContainer>
  );
};

export default RequestVisit;
