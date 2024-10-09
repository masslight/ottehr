import { useEffect, useState } from 'react';
import { TelemedAppointmentStatus, checkIsEncounterForPractitioner, TelemedAppointmentInformation } from 'ehr-utils';
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
      [TelemedAppointmentStatus.complete, TelemedAppointmentStatus.unsigned].includes(
        appointment.telemedStatus as TelemedAppointmentStatus,
      ) ||
      ([TelemedAppointmentStatus['pre-video'], TelemedAppointmentStatus['on-video']].includes(
        appointment.telemedStatus as TelemedAppointmentStatus,
      ) &&
        !isEncounterForPractitioner)
    ) {
      if (
        appointment.telemedStatus === TelemedAppointmentStatus.unsigned &&
        appointment.location.state &&
        availableStates.includes(appointment.location.state) &&
        isEncounterForPractitioner
      ) {
        setType('viewContained');
      } else {
        setType('viewOutlined');
      }
    } else if (appointment.telemedStatus === TelemedAppointmentStatus.ready) {
      setType('assignMe');
    } else if (appointment.telemedStatus === TelemedAppointmentStatus['pre-video']) {
      setType('unassign');
    } else if (appointment.telemedStatus === TelemedAppointmentStatus['on-video']) {
      setType('reconnect');
    } else {
      setType('');
    }
  }, [appointment.location.state, availableStates, appointment.telemedStatus, isEncounterForPractitioner]);

  return { type };
};
