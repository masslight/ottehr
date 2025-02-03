import { Encounter } from 'fhir/r4b';
import Oystehr from '@oystehr/sdk';
import { changeInPersonVisitStatus } from '../api/api';
import { User, VisitStatusWithoutUnknown } from 'utils';

export const handleChangeInPersonVisitStatus = async (
  encounter: Encounter | undefined,
  user: User | undefined,
  oystehr: Oystehr | undefined,
  updatedStatus: VisitStatusWithoutUnknown
): Promise<void> => {
  if (!oystehr || !encounter || !user || !updatedStatus) {
    console.warn('Missing required data:', { oystehr, encounter, user, profileResource: user?.profileResource }); //
    return;
  }

  try {
    await changeInPersonVisitStatus(oystehr, {
      encounterId: encounter.id,
      user,
      updatedStatus,
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};
