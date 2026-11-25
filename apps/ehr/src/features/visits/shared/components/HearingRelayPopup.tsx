import { ReactElement } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { getQuestionnaireResponseByLinkId } from 'utils/lib/helpers/paperwork/paperwork-response';
import { useAppointmentData } from '../stores/appointment/appointment.store';

interface HearingRelayPopupProps {
  onClose: () => void;
  isOpen: boolean;
}

const HearingRelayPopup = ({ onClose, isOpen }: HearingRelayPopupProps): ReactElement => {
  const { questionnaireResponse } = useAppointmentData();

  const patientPhoneNumber =
    getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0]?.valueString ||
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]?.valueString ||
    '';

  return (
    <AppDialog
      variant="alert"
      open={isOpen}
      onClose={onClose}
      title="Patient Requires a Hearing Impaired Relay Service (711)"
    >
      {`Patient requires a Hearing Impaired Relay Service (711). Patient number is ${patientPhoneNumber}.`}
    </AppDialog>
  );
};

export default HearingRelayPopup;
