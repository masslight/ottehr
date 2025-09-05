import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter } from 'fhir/r4b';
import moment from 'moment';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

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
      throw new Error('Missing required parameters: deviceId, patientId');
    }

    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);
    const user = await oystehr.user.me();
    const ts = requestBody.ts;
    const tz = requestBody.tz ?? 'UTC+0';
    const offset = getOffsetFromTZ(tz);
    const tsUTC = moment.unix(ts).utcOffset(offset).utc().format('YYYY-MM-DDTHH:mm:ss.SSS[+00:00]');

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
        ],
      })
    ).unbundle();

    if (!encounterResults) {
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
              start: tsUTC,
            },
          },
        ],
        period: {
          start: tsUTC,
        },
        statusHistory: [
          {
            status: 'in-progress',
            period: {
              start: tsUTC,
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

function getOffsetFromTZ(tz: string): string {
  const match = tz.match(/UTC([+-]\d+)/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const offset = hours >= 0 ? `+${String(hours).padStart(2, '0')}:00` : `${String(hours).padStart(3, '0')}:00`;
    return offset;
  }
  return '+00:00';
}
