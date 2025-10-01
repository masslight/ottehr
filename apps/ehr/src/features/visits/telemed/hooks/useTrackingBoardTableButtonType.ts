import { useEffect, useState } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  checkEncounterHasPractitioner,
  getSelectors,
  TelemedAppointmentInformation,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { useTrackingBoardStore } from '../state/tracking-board/tracking-board.store';

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
      !appointment.locationVirtual.state ||
      !availableStates.includes(appointment.locationVirtual.state) ||
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
        appointment.locationVirtual.state &&
        availableStates.includes(appointment.locationVirtual.state) &&
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
  }, [appointment.locationVirtual.state, availableStates, appointment.telemedStatus, isEncounterForPractitioner]);

  return { type };
};
