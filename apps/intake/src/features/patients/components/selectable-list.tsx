import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { FieldValues } from 'react-hook-form';
import { FormInputType, PageForm } from 'ui-components';
import { getPatientInfoFullName, PatientInfo } from 'utils';
import { otherColors } from '../../../IntakeThemeProvider';

interface PatientListProps {
  patients: PatientInfo[];
  subtitle: string;
  showNewPatientOption?: boolean;
  selectedPatient?: PatientInfo;
  buttonLoading?: boolean;
  onSubmit: (data: FieldValues) => Promise<void>;
  onBack?: () => void;
}

const PatientList: React.FC<PatientListProps> = ({
  patients,
  selectedPatient,
  subtitle,
  buttonLoading,
  showNewPatientOption = true,
  onSubmit,
  onBack,
}) => {
  const formElements: FormInputType[] = useMemo(() => {
    return [
      {
        type: 'Radio',
        name: 'patientID',
        label: subtitle,
        defaultValue: selectedPatient,
        required: true,
        radioOptions: (patients || [])
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
              color: otherColors.lightBlue,
            };
          })
          .concat(
            ...(showNewPatientOption
              ? [
                  {
                    label: 'Different family member',
                    description: '',
                    value: 'new-patient',
                    color: otherColors.lightBlue,
                  },
                ]
              : [])
          ),
      },
    ];
  }, [patients, selectedPatient, showNewPatientOption, subtitle]);

  return (
    <PageForm formElements={formElements} onSubmit={onSubmit} controlButtons={{ onBack, loading: buttonLoading }} />
  );
};

export default PatientList;
