import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { TELEMED_VIDEO_ROOM_CODE, getVirtualServiceResourceExtension } from 'utils';

export const getVideoEncounterForAppointment = async (
  appointmentID: string,
  oystehr: Oystehr
): Promise<Encounter | undefined> => {
  let encounter: Encounter | undefined = undefined;

  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: 'appointment',
          value: `Appointment/${appointmentID}`,
        },
      ],
    })
  ).unbundle();

  encounter = (encounters ?? []).find((encounterTemp) =>
    Boolean(getVirtualServiceResourceExtension(encounterTemp, TELEMED_VIDEO_ROOM_CODE))
  );
  return encounter;
};
