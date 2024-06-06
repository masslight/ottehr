import { DateTime } from 'luxon';
import { FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { PageForm } from 'ottehr-components';
import { getSelectors } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { useAppointmentStore } from '../features/appointments';
import { CustomContainer } from '../features/common';
import { useFilesStore } from '../features/files';
import { usePaperworkStore } from '../features/paperwork';
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

const SelectPatient = (): JSX.Element => {
  const { patientInfo: currentPatientInfo, setNewPatient } = usePatientInfoStore.getState();

  const navigate = useNavigate();

  const patientsStore = getSelectors(usePatientsStore, ['patients']);

  const onSubmit = (data: FieldValues): void => {
    if (currentPatientInfo.id !== data.patientId) {
      const selectedPatient = patientsStore.patients?.find((patient) => patient.id === data.patientId);

      if (selectedPatient) {
        usePatientInfoStore.setState(() => ({
          patientInfo: {
            id: selectedPatient.id,
            newPatient: false,
            firstName: selectedPatient.firstName,
            lastName: selectedPatient.lastName,
            dateOfBirth: DateTime.fromISO(selectedPatient.dateOfBirth || '').toString(),
            sex: selectedPatient.sex,
            reasonForVisit: currentPatientInfo?.reasonForVisit,
            email: selectedPatient.email,
            emailUser: selectedPatient.emailUser,
          },
        }));
      } else {
        setNewPatient();
      }
    }
    const urlParams = new URLSearchParams(window.location.search);
    const flow = urlParams.get('flow');
    if (flow === 'requestVisit') {
      useAppointmentStore.setState({ appointmentDate: undefined, appointmentID: undefined });
      usePaperworkStore.setState({ paperworkQuestions: undefined, completedPaperwork: undefined });
      useFilesStore.setState({ fileURLs: undefined });
      navigate(IntakeFlowPageRoute.PatientInformation.path);
    } else if (flow === 'pastVisits') {
      navigate(IntakeFlowPageRoute.PastVisits.path);
    }
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
                    'MMMM dd, yyyy'
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

export default SelectPatient;
