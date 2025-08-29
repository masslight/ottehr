import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Encounter, FhirResource, Provenance } from 'fhir/r4b';
import {
  createExtensionValue,
  findExtensionIndex,
  getPatchBinary,
  getSecret,
  PendingSupervisorApprovalInputValidated,
  SecretsKeys,
  visitStatusToFhirEncounterStatusMap,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createProvenanceForEncounter } from '../../shared/createProvenanceForEncounter';
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

      const encounterStatus = visitStatusToFhirEncounterStatusMap['completed'];

      const encounterPatchOps: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: encounterStatus,
        },
      ];

      const awaitingSupervisorApprovalExtension = createExtensionValue(
        'awaiting-supervisor-approval',
        true,
        'valueBoolean'
      );
      const existingExtensionIndex = findExtensionIndex(encounter.extension ?? [], 'awaiting-supervisor-approval');

      if (existingExtensionIndex >= 0) {
        encounterPatchOps.push({
          op: 'replace',
          path: `/extension/${existingExtensionIndex}`,
          value: awaitingSupervisorApprovalExtension,
        });
      } else {
        encounterPatchOps.push({
          op: 'add',
          path: encounter.extension ? '/extension/-' : '/extension',
          value: encounter.extension ? awaitingSupervisorApprovalExtension : [awaitingSupervisorApprovalExtension],
        });
      }

      const encounterPatch = getPatchBinary({
        resourceType: 'Encounter',
        resourceId: encounter.id!,
        patchOperations: encounterPatchOps,
      });

      const provenanceCreate: BatchInputRequest<Provenance> = {
        method: 'POST',
        url: '/Provenance',
        resource: createProvenanceForEncounter(encounter.id!, practitionerId, 'author'),
      };

      await oystehr.fhir.transaction({
        requests: [encounterPatch, provenanceCreate] as BatchInputRequest<FhirResource>[],
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
