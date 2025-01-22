import { useEffect, useState } from 'react';
import { ApptStatus, checkIsEncounterForPractitioner, TelemedAppointmentInformation } from 'ehr-utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../state';
import useOttehrUser from '../../hooks/useOttehrUser';

export const useTrackingBoardTableButtonType = ({
  appointment,
}: {
  appointment: TelemedAppointmentInformation;
}): { type: string } => {
  const [type, setType] = useState('');

  const { availableStates } = getSelectors(useTrackingBoardStore, ['availableStates']);
  const user = useOttehrUser();

  const isEncounterForPractitioner =
    !!user?.profileResource && checkIsEncounterForPractitioner(appointment.encounter, user.profileResource);

  useEffect(() => {
    if (
      !appointment.location.state ||
      !availableStates.includes(appointment.location.state) ||
      [ApptStatus.complete, ApptStatus.unsigned].includes(appointment.telemedStatus as ApptStatus) ||
      ([ApptStatus['pre-video'], ApptStatus['on-video']].includes(appointment.telemedStatus as ApptStatus) &&
        !isEncounterForPractitioner)
    ) {
      if (
        appointment.telemedStatus === ApptStatus.unsigned &&
        appointment.location.state &&
        availableStates.includes(appointment.location.state) &&
        isEncounterForPractitioner
      ) {
        setType('viewContained');
      } else {
        setType('viewOutlined');
      }
    } else if (appointment.telemedStatus === ApptStatus.ready) {
      setType('assignMe');
    } else if (appointment.telemedStatus === ApptStatus['pre-video']) {
      setType('unassign');
    } else if (appointment.telemedStatus === ApptStatus['on-video']) {
      setType('reconnect');
    } else {
      setType('');
    }
  }, [appointment.location.state, availableStates, appointment.telemedStatus, isEncounterForPractitioner]);

  return { type };
};
