import { Coding, Encounter } from 'fhir/r4b';
import { EvolveUser } from '../hooks/useEvolveUser';
import Oystehr from '@oystehr/sdk';
import { assignPractitioner, unassignPractitioner } from '../api/api';

export const practitionerType = {
  Admitter: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
      code: 'ADM',
      display: 'admitter',
    },
  ] as Coding[],
  Attender: [
    {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
      code: 'ATND',
      display: 'attender',
    },
  ] as Coding[],
};

export const handleParticipantPeriod = async (
  oystehrZambda: Oystehr | undefined,
  encounter: Encounter | undefined,
  user: EvolveUser | undefined,
  action: 'start' | 'end',
  practitionerType: Coding[]
): Promise<void> => {
  if (!oystehrZambda || !encounter || !user || !user.profileResource?.id) {
    console.warn('Missing required data:', { oystehrZambda, encounter, user, profileResource: user?.profileResource }); //
    return;
  }

  try {
    if (action === 'start') {
      await assignPractitioner(oystehrZambda, {
        encounterId: encounter.id,
        practitioner: user.profileResource,
        userRole: practitionerType,
      });
    } else {
      await unassignPractitioner(oystehrZambda, {
        encounterId: encounter.id,
        practitioner: user.profileResource,
        userRole: practitionerType,
      });
    }
  } catch (error) {
    throw new Error(`Failed to ${action} practitioner: ${error}`);
  }
};
