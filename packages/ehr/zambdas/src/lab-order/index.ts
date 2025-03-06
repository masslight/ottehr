import { APIGatewayProxyResult } from 'aws-lambda';
import { getPatchBinary } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';
import { Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import { getLabOrderResources } from '../shared/labs';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { serviceRequestID, data, secrets } = validateRequestParameters(input);

    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    console.log('token', m2mtoken);

    const oystehr = createOystehrClient(m2mtoken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const currentUser = await createOystehrClient(userToken, secrets).user.me();

    const { serviceRequest, questionnaireResponse, task } = await getLabOrderResources(oystehr, serviceRequestID);

    const fhirUrl = `urn:uuid:${uuid()}`;
    const provenanceFhir: Provenance = {
      resourceType: 'Provenance',
      target: [
        {
          reference: `ServiceRequest/${serviceRequest.id}`,
        },
      ],
      recorded: DateTime.now().toISO(),
      location: task.location,
      agent: [
        {
          who: task.owner ? task.owner : { reference: currentUser?.profile },
        },
      ],
    };
    Object.keys(data).map((item) => console.log(typeof data[item], data[item]));
    await oystehr?.fhir.batch({
      requests: [
        getPatchBinary({
          resourceType: 'QuestionnaireResponse',
          resourceId: questionnaireResponse.id || 'unknown',
          patchOperations: [
            {
              op: 'add',
              path: '/item',
              value: Object.keys(data).map((questionResponse) => ({
                linkId: questionResponse,
                answer: [
                  typeof data[questionResponse] === 'boolean'
                    ? {
                        valueBoolean: data[questionResponse],
                      }
                    : {
                        valueString: Array.isArray(data[questionResponse])
                          ? data[questionResponse].join(',')
                          : data[questionResponse],
                      },
                ],
              })),
            },
          ],
        }),
        getPatchBinary({
          resourceType: 'ServiceRequest',
          resourceId: serviceRequest.id || 'unknown',
          patchOperations: [
            {
              path: '/status',
              op: 'replace',
              value: 'active',
            },
          ],
        }),
        {
          method: 'POST',
          url: '/Provenance',
          fullUrl: fhirUrl,
          resource: provenanceFhir,
        },
        // getPatchBinary({
        //   resourceType: 'Task',
        //   resourceId: taskFhir.id || 'unknown',
        //   patchOperations: [
        //     {
        //       op: 'add',
        //       path: '/owner',
        //       value: {
        //         reference: currentUser?.profile,
        //       },
        //     },
        //     {
        //       op: 'add',
        //       path: '/relevantHistory',
        //       value: [
        //         {
        //           reference: fhirUrl,
        //         },
        //       ],
        //     },
        //   ],
        // }),
      ],
    });

    return {
      body: JSON.stringify({ message: 'success' }),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error creating a lab order' }),
      statusCode: 500,
    };
  }
};
