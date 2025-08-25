// cSpell:ignore Gmailerrorred
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import { capitalize, useTheme } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { getUnconfirmedDOBForAppointment, getWeightForPatient, mdyStringFromISOString } from 'utils';
import { PencilIconButton } from '../../../components';
import { useAppointmentData } from '../../../state';
import { EditPatientBirthDateDialog } from './EditPatientBirthDateDialog';
import { InformationCard } from './InformationCard';

export const AboutPatientContainer: FC = () => {
  const theme = useTheme();
  const { patient, appointment } = useAppointmentData();
  const [updateDOBModalOpen, setUpdateDOBModalOpen] = useState<boolean>(false);
  const closePatientDOBModal = (): void => setUpdateDOBModalOpen(false);
  const unconfirmedDOB = appointment && getUnconfirmedDOBForAppointment(appointment);
  const weight = getWeightForPatient(patient);
  const reasonForVisit = useMemo(() => {
    const complaints = (appointment?.description ?? '').split(',');
    return complaints.map((complaint) => complaint.trim()).join(', ');
  }, [appointment?.description]);

  return (
    <>
      <InformationCard
        title="About the patient"
        fields={[
          {
            label: "Patient's date of birth (Original)",
            value: patient?.birthDate && mdyStringFromISOString(patient?.birthDate),
            button: (
              <PencilIconButton onClick={() => setUpdateDOBModalOpen(true)} size="16px" sx={{ padding: '10px' }} />
            ),
          },
          {
            label: "Patient's date of birth (Unmatched)",
            value: unconfirmedDOB && unconfirmedDOB !== 'true' ? mdyStringFromISOString(unconfirmedDOB) : '-',
            icon: <ReportGmailerrorredIcon sx={{ color: theme.palette.warning.main, fontSize: '1rem' }} />,
          },
          { label: "Patient's sex", value: capitalize(patient?.gender || '') },
          { label: 'Reason for visit', value: reasonForVisit },
          { label: 'Patient weight (lbs)', value: weight },
        ]}
      />
      <EditPatientBirthDateDialog modalOpen={updateDOBModalOpen} onClose={closePatientDOBModal} />
    </>
  );
};
