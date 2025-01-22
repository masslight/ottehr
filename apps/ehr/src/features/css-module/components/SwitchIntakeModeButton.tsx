import React from 'react';
import { ButtonRounded } from './RoundedButton';
import { useNavigationContext } from '../context/NavigationContext';
import { practitionerType } from '../../../helpers/practitionerUtils';
import { useAppointment } from '../hooks/useAppointment';
import { usePractitionerActions } from '../hooks/usePractitioner';
import { useParams } from 'react-router-dom';

export const SwitchIntakeModeButton = (): React.ReactElement => {
  const { id: appointmentID } = useParams();
  const { interactionMode, setInteractionMode } = useNavigationContext();
  const { refetch } = useAppointment(appointmentID || '');
  const nextMode = interactionMode === 'intake' ? 'provider' : 'intake';
  const practitionerTypeFromMode = interactionMode === 'intake' ? practitionerType.Attender : practitionerType.Admitter;
  const { isPractitionerLoading, handleButtonClick } = usePractitionerActions(
    appointmentID ?? '',
    'start',
    practitionerTypeFromMode
  );

  const isDisabled = !appointmentID || isPractitionerLoading;

  return (
    <ButtonRounded
      onClick={async () => {
        if (!appointmentID) return;
        await handleButtonClick();
        void refetch();
        setInteractionMode(nextMode);
      }}
      variant="contained"
      disabled={isDisabled}
    >
      {nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}
    </ButtonRounded>
  );
};
