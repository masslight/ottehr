import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter } from 'fhir/r4b';
import { createOystehrClient, getAuth0Token, getUser, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;

export const index = wrapHandler('get-create-timer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    let requestBody;
    try {
      requestBody = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
      if (requestBody.body) {
        requestBody = typeof requestBody.body === 'string' ? JSON.parse(requestBody.body) : requestBody.body;
      }
    } catch (e) {
      console.error('Failed to parse body:', e);
      throw new Error('Invalid request body format');
    }

    const { patientId } = requestBody;

    if (!patientId) {
      throw new Error('Missing required parameters: patientId');
    }

    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);
    const userToken = input.headers.Authorization?.replace('Bearer ', '');
    const user = userToken && (await getUser(userToken, input.secrets));

    const encounterResults = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [
          {
            name: 'subject',
            value: `Patient/${patientId}`,
          },
          {
            name: 'status',
            value: 'in-progress',
          },
          {
            name: 'participant',
            value: `${user.profile}`,
          },
          {
            name: 'class',
            value: 'OBSENC',
          },
          {
            name: '_sort',
            value: '-date',
          },
          {
            name: '_total',
            value: 'accurate',
          },
          {
            name: '_count',
            value: '1',
          },
        ],
      })
    ).unbundle();
    console.log('encounterResults :', encounterResults);

    if (!encounterResults || encounterResults.length === 0) {
      const createEncounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'OBSENC',
          display: 'observation encounter',
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        participant: [
          {
            individual: {
              type: 'Practitioner',
              reference: `${user.profile}`,
            },
            period: {
              start: new Date().toISOString(),
            },
          },
        ],
        period: {
          start: new Date().toISOString(),
        },
        statusHistory: [
          {
            status: 'in-progress',
            period: {
              start: new Date().toISOString(),
            },
          },
        ],
      };
      const encounter = await oystehr.fhir.create<any>(createEncounter);
      return lambdaResponse(200, {
        message: `Successfully created timer value`,
        encounterResults: encounter,
      });
    } else {
      return lambdaResponse(200, {
        message: `Successfully retrieved timer value`,
        encounterResults: encounterResults,
      });
    }
  } catch (error: any) {
    console.error('Error:', error);
    return lambdaResponse(500, {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
