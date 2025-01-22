import { useEffect, useState } from 'react';
import { TelemedAppointmentInformation, TelemedAppointmentStatusEnum, checkEncounterHasPractitioner } from 'utils';
import useEvolveUser from '../../hooks/useEvolveUser';
import { getSelectors } from '../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../state';

export const useTrackingBoardTableButtonType = ({
  appointment,
}: {
  appointment: TelemedAppointmentInformation;
}): { type: string } => {
  const [type, setType] = useState('');

  const { availableStates } = getSelectors(useTrackingBoardStore, ['availableStates']);
  const user = useEvolveUser();

  const isEncounterForPractitioner =
    !!user?.profileResource && checkEncounterHasPractitioner(appointment.encounter, user.profileResource);

  useEffect(() => {
    if (
      !appointment.location.state ||
      !availableStates.includes(appointment.location.state) ||
      [TelemedAppointmentStatusEnum.complete, TelemedAppointmentStatusEnum.unsigned].includes(
        appointment.telemedStatus as TelemedAppointmentStatusEnum
      ) ||
      ([TelemedAppointmentStatusEnum['pre-video'], TelemedAppointmentStatusEnum['on-video']].includes(
        appointment.telemedStatus as TelemedAppointmentStatusEnum
      ) &&
        !isEncounterForPractitioner)
    ) {
      if (
        appointment.telemedStatus === TelemedAppointmentStatusEnum.unsigned &&
        appointment.location.state &&
        availableStates.includes(appointment.location.state) &&
        isEncounterForPractitioner
      ) {
        setType('viewContained');
      } else {
        setType('viewOutlined');
      }
    } else if (appointment.telemedStatus === TelemedAppointmentStatusEnum.ready) {
      setType('assignMe');
    } else if (appointment.telemedStatus === TelemedAppointmentStatusEnum['pre-video']) {
      setType('unassign');
    } else if (appointment.telemedStatus === TelemedAppointmentStatusEnum['on-video']) {
      setType('reconnect');
    } else {
      setType('');
    }
  }, [appointment.location.state, availableStates, appointment.telemedStatus, isEncounterForPractitioner]);

  return { type };
};
