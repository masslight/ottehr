import { isAnnotationFollowupEncounter } from 'utils';
import { DataComposer } from '../../pdf-common';
import { EncounterDataInput, EncounterInfo } from '../../types';

export const composeEncounterData: DataComposer<EncounterDataInput, EncounterInfo> = ({ encounter }) => {
  // Only annotation follow-ups render the abbreviated visit-note layout — scheduled
  // follow-ups are full visits and get the same sections as a main appointment.
  const isFollowup = encounter ? isAnnotationFollowupEncounter(encounter) : false;

  return {
    isFollowup,
  };
};
