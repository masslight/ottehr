import { Encounter } from 'fhir/r4b';
import { useEffect, useMemo, useState } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  allLicensesForPractitioner,
  AppointmentLocation,
  checkEncounterHasPractitioner,
  TelemedAppointmentStatusEnum,
  TelemedCallStatuses,
} from 'utils';

export const useTrackingBoardTableButtonType = ({
  appointment,
}: {
  appointment: {
    id: string;
    locationVirtual: AppointmentLocation;
    telemedStatus: TelemedCallStatuses;
    encounter: Encounter;
  };
}): { type: string } => {
  const [type, setType] = useState('');

  const user = useEvolveUser();

  const availableStates = useMemo(() => {
    return (user?.profileResource && allLicensesForPractitioner(user.profileResource).map((item) => item.state)) ?? [];
  }, [user]);

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
