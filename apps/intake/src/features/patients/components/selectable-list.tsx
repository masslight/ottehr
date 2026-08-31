import { Box } from '@mui/system';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { FieldValues } from 'react-hook-form';
import { FormInputType } from 'src/types/form/form-input-type';
import { getPatientInfoFullName } from 'utils/lib/fhir/patient';
import { PatientInfo } from 'utils/lib/types/data/telemed/appointments/create-appointment.types';
import PageForm from '../../../components/PageForm';
import { otherColors } from '../../../IntakeThemeProvider';
import { DIFFERENT_FAMILY_MEMBER_DATA } from '../../../telemed/utils/constants';

interface PatientListProps {
  patients: PatientInfo[];
  subtitle: string;
  selectedPatient?: PatientInfo;
  buttonLoading?: boolean;
  pastVisits?: boolean;
  bottomMessage?: string;
  onSubmit: (data: FieldValues) => Promise<void>;
  onBack?: () => void;
}

const PatientList: React.FC<PatientListProps> = ({
  patients = [],
  selectedPatient,
  subtitle,
  buttonLoading,
  pastVisits,
  bottomMessage,
  onSubmit,
  onBack,
}) => {
  const hasNoPatients = patients.length === 0;

  const formElements: FormInputType[] = useMemo(() => {
    return [
      {
        type: 'Radio',
        name: 'patientID',
        label: subtitle,
        defaultValue: selectedPatient?.id,
        required: true,
        borderColor: 'action.disabled',
        backgroundSelected: otherColors.lightBlue,
        radioOptions: hasNoPatients
          ? []
          : patients
              .sort((a, b) => {
                if (!a.firstName) return 1;
                if (!b.firstName) return -1;
                return a.firstName.localeCompare(b.firstName);
              })
              .map((patient) => {
                if (!patient.id) {
                  throw new Error('Patient id is not defined');
                }
                return {
                  label: getPatientInfoFullName(patient),
                  description: `Birthday: ${DateTime.fromFormat(patient.dateOfBirth || '', 'yyyy-MM-dd').toFormat(
                    'MMMM dd, yyyy'
                  )}`,
                  value: patient.id,
                };
              })
              .concat(pastVisits ? [] : DIFFERENT_FAMILY_MEMBER_DATA),
      },
    ];
  }, [hasNoPatients, pastVisits, patients, selectedPatient, subtitle]);

  return (
    <PageForm
      formElements={formElements}
      onSubmit={onSubmit}
      controlButtons={{ onBack, loading: buttonLoading, submitDisabled: pastVisits && hasNoPatients }}
      bottomComponent={bottomMessage ? <Box sx={{ pt: 2, color: 'text.primary' }}>{bottomMessage}</Box> : undefined}
    />
  );
};

export default PatientList;
