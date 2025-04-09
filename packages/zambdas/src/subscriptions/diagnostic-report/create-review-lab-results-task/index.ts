import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Organization, ServiceRequest, Task, Provenance, Reference } from 'fhir/r4b';
import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared/types';
import { validateRequestParameters } from './validateRequestParameters';
import { LAB_ORDER_TASK } from 'utils';
import { createOystehrClient } from '../../../shared/helpers';
import { getAuth0Token, topLevelCatch } from '../../../shared';
import { unpackResultsAndValidate } from './helpers';
import { DateTime } from 'luxon';
import { randomUUID } from 'crypto';

export interface ReviewLabResultSubscriptionInput {
  diagnosticReport: DiagnosticReport;
  secrets: Secrets | null;
}

export type FHIRSearchResult = DiagnosticReport | ServiceRequest | Organization | Task;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input, undefined, 2)}`);

  try {
    const { diagnosticReport, secrets } = validateRequestParameters(input);

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);
    const requests: BatchInputRequest<Task | Provenance>[] = [];

    const searchResults = (
      await oystehr.fhir.search<FHIRSearchResult>({
        resourceType: 'DiagnosticReport',
        params: [
          { name: '_id', value: diagnosticReport.id ?? '' },
          { name: '_include', value: 'DiagnosticReport:based-on:ServiceRequest' },
          { name: '_include:iterate', value: 'ServiceRequest:performer:Organization' },
          { name: '_revinclude:iterate', value: 'Task:based-on' },
          { name: '_revinclude:iterate', value: 'Task:based-on' },
        ],
      })
    ).unbundle();

    const { tasks: existingTasks, organization: org } = unpackResultsAndValidate(searchResults);

    // TODO: it's an issue to use the Org as the agent in the case of unsolicited results. Maybe there is am M2M that would be better suited to use.
    existingTasks.forEach((task) => {
      if (task.id && ['ready', 'in-progress'].includes(task.status)) {
        // create a new Provenance record for the cancellation
        const provenanceFullUrl = `urn:uuid:${randomUUID()}`;

        requests.push({
          url: '/Provenance',
          fullUrl: provenanceFullUrl,
          method: 'POST',
          resource: {
            resourceType: 'Provenance',
            target: [
              {
                type: 'Task',
                reference: `Task/${task.id}`,
              },
            ],
            recorded: DateTime.now().toISO(),
            agent: [
              {
                who: {
                  type: 'Organization',
                  reference: `Organization/${org.id}`,
                },
              },
            ],
            activity: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
                  code: 'UPDATE',
                },
              ],
            },
          },
        });

        // cancel the current task as the new task will take precedence
        const newProvenanceReference: Reference = { type: 'Provenance', reference: provenanceFullUrl };
        requests.push({
          url: `/Task/${task.id}`,
          method: 'PATCH',
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'cancelled',
            },
            {
              op: task.relevantHistory ? 'replace' : 'add',
              path: '/relevantHistory',
              value: task.relevantHistory
                ? [...task.relevantHistory, newProvenanceReference]
                : [newProvenanceReference],
            },
          ],
        });
      }
    });

    // make the new task and its provenance
    const newTaskFullUrl = `urn:uuid:${randomUUID()}`;
    const newTaskProvenanceFullUrl = `urn:uuid:${randomUUID()}`;

    const newTask: Task = {
      resourceType: 'Task',
      authoredOn: DateTime.now().toISO(),
      intent: 'order',
      basedOn: [
        {
          type: 'DiagnosticReport',
          reference: `DiagnosticReport/${diagnosticReport.id}`,
        },
      ],
      status: 'ready',
      code: {
        coding: [
          {
            system: LAB_ORDER_TASK.system,
            code:
              diagnosticReport.status === 'preliminary'
                ? LAB_ORDER_TASK.code.reviewPreliminaryResult
                : LAB_ORDER_TASK.code.reviewFinalResult,
          },
        ],
      },
      relevantHistory: [{ type: 'Provenance', reference: newTaskProvenanceFullUrl }],
    };

    // TODO: see todo about agent and org above
    const newProvenance: Provenance = {
      resourceType: 'Provenance',
      target: [
        {
          type: 'Task',
          reference: newTaskFullUrl,
        },
      ],
      recorded: DateTime.now().toISO(),
      agent: [
        {
          who: {
            type: 'Organization',
            reference: `Organization/${org.id}`,
          },
        },
      ],
      activity: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
            code: 'CREATE',
          },
        ],
      },
    };

    requests.push(
      {
        method: 'POST',
        url: '/Task',
        fullUrl: newTaskFullUrl,
        resource: newTask,
      },
      {
        method: 'POST',
        url: '/Provenance',
        fullUrl: newTaskProvenanceFullUrl,
        resource: newProvenance,
      }
    );

    const oystehrResponse = await oystehr.fhir.transaction<Task | Provenance>({ requests });

    const response: {
      [key: string]: Task[];
    } = {
      updatedTasks: [],
      createdTasks: [],
    };

    oystehrResponse.entry?.forEach((ent) => {
      if (ent.response?.outcome?.id === 'ok' && ent.resource?.resourceType === 'Task')
        response.updatedTasks.push(ent.resource);
      else if (ent.response?.outcome?.id === 'created' && ent.resource?.resourceType === 'Task')
        response.createdTasks.push(ent.resource);
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('create-review-lab-results-task', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
