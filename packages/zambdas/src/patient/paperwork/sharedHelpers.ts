import Oystehr, { BatchInputRequest, User } from '@oystehr/sdk';
import { Coding, Flag } from 'fhir/r4b';
import { formatPhoneNumberDisplay, getPatchBinary } from 'utils';

export async function createOrUpdateFlags(
  flagName: string,
  existingFlags: Flag[],
  patientID: string,
  encounterID: string,
  timestamp: string,
  oystehr: Oystehr,
  user?: User | undefined
): Promise<void> {
  if (!existingFlags || !existingFlags.length) {
    const metaTags: Coding[] = [{ code: flagName }];
    let formattedUserNumber: string | undefined;
    let paperworkStartedBy: string | undefined;
    let createdByTag: Coding | undefined;
    if (user) {
      formattedUserNumber = formatPhoneNumberDisplay(user?.name.replace('+1', '') || '');
      paperworkStartedBy = `Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;
    }
    if (formattedUserNumber && paperworkStartedBy) {
      createdByTag = { system: 'created-date-time', display: paperworkStartedBy, version: timestamp };
      metaTags.push(createdByTag);
    }

    // if no flags exist create one
    const flag = await oystehr.fhir.create({
      resourceType: 'Flag',
      status: 'active',
      code: {
        coding: [
          {
            system: 'https://fhir.zapehr.com/r4/StructureDefinitions/flag-code',
            code: flagName,
            display: flagName,
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'https://hl7.org/fhir/R4/codesystem-flag-category.html',
              code: 'admin',
              display: 'Administrative',
            },
          ],
        },
      ],
      subject: {
        type: 'Patient',
        reference: `Patient/${patientID}`,
      },
      period: {
        start: timestamp,
      },
      encounter: {
        reference: `Encounter/${encounterID}`,
      },
      meta: {
        tag: metaTags,
      },
    });
    console.log(`New flag created for ${flagName}`, flag);
  } else {
    // update the existing flags
    const requests: BatchInputRequest<Flag>[] = [];

    requests.push(
      getPatchBinary({
        resourceType: 'Flag',
        resourceId: existingFlags[0].id ?? '',
        patchOperations: [
          {
            op: 'replace',
            path: '/period/start',
            value: timestamp,
          },
        ],
      })
    );

    // deactivate any other active flags
    existingFlags.slice(1).forEach((flag) => {
      requests.push(
        getPatchBinary({
          resourceType: 'Flag',
          resourceId: flag.id ?? '',
          patchOperations: [
            {
              op: 'replace',
              path: '/status',
              value: 'inactive',
            },
          ],
        })
      );
    });

    await oystehr.fhir.batch({ requests: requests });
    console.log(`Updated flag ${flagName} period.start to ${timestamp}`);
  }
}
