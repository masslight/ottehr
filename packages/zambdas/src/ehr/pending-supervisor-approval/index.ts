import { APIGatewayProxyResult } from 'aws-lambda';
import { CodeableConcept, Coding, Encounter, Provenance } from 'fhir/r4b';
import {
  createExtensionValue,
  findExtensionIndex,
  getSecret,
  PendingSupervisorApprovalInputValidated,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'pending-supervisor-approval',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    console.log(`pending-supervisor-approval started, input: ${JSON.stringify(input)}`);

    let validatedParameters: PendingSupervisorApprovalInputValidated;

    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `Invalid request parameters. ${error.message || error}`,
        }),
      };
    }

    try {
      const { encounterId, practitionerId, secrets } = validatedParameters;
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const encounter = (
        await oystehr.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [
            {
              name: '_id',
              value: encounterId,
            },
          ],
        })
      ).unbundle()[0];

      await oystehr.fhir.update<Encounter>({
        ...getUpdatedEncounter(encounter),
        resourceType: 'Encounter',
        id: encounter.id,
      });

      await oystehr.fhir.create<Provenance>({
        ...createProvenanceForEncounter(encounterId, practitionerId, 'author'),
      });

      console.log(`Updated encounter: ${encounter.id}.`);
      const appointmentId = encounter.appointment?.[0].reference?.split('/')[1];

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Successfully updated visit #${appointmentId} to await supervisor approval`,
        }),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      await topLevelCatch('pending-supervisor-approval', error, ENVIRONMENT);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: `Error pending supervisor approval: ${error}` }),
      };
    }
  }
);

const getUpdatedEncounter = (encounter: Encounter): Encounter => {
  const awaitingSupervisorApprovalExtension = createExtensionValue(
    'awaiting-supervisor-approval',
    true,
    'valueBoolean'
  );

  const updatedEncounter: Encounter = structuredClone(encounter);

  if (!updatedEncounter.extension) {
    updatedEncounter.extension = [];
  }
  const existingExtensionIndex = findExtensionIndex(updatedEncounter.extension, 'awaiting-supervisor-approval');

  if (existingExtensionIndex >= 0) {
    updatedEncounter.extension[existingExtensionIndex] = awaitingSupervisorApprovalExtension;
  } else {
    updatedEncounter.extension.push(awaitingSupervisorApprovalExtension);
  }

  updatedEncounter.status = 'finished';

  return updatedEncounter;
};

export function createProvenanceForEncounter(
  encounterId: string,
  practitionerId: string,
  role: 'author' | 'verifier',
  recorded: string = new Date().toISOString()
): Provenance {
  const roleCoding: Coding = {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
    code: role,
    display: role === 'author' ? 'Author' : 'Verifier',
  };

  const roleConcept: CodeableConcept = {
    coding: [roleCoding],
  };

  return {
    resourceType: 'Provenance',
    target: [
      {
        reference: `Encounter/${encounterId}`,
      },
    ],
    recorded,
    agent: [
      {
        role: [roleConcept],
        who: {
          reference: `Practitioner/${practitionerId}`,
        },
      },
    ],
  };
}
