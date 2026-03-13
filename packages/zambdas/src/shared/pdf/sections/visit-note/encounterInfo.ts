import { isFollowupEncounter } from 'utils';
import { DataComposer } from '../../pdf-common';
import { EncounterDataInput, EncounterInfo } from '../../types';

export const composeEncounterData: DataComposer<EncounterDataInput, EncounterInfo> = ({ encounter }) => {
  const isFollowup = encounter ? isFollowupEncounter(encounter) : false;

  return {
    isFollowup,
  };
};
