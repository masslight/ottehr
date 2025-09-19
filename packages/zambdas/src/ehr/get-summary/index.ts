import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { getFirstName, getLastName } from 'utils';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;

export const index = wrapHandler('get-summary', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    const { patientId, count, offset } = requestBody;

    if (!patientId) {
      throw new Error('Missing required parameters: patientId');
    }

    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);

    const searchResult = await oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: '_sort', value: '-date' },
        { name: '_total', value: 'accurate' },
        { name: 'class', value: 'OBSENC' },
        { name: 'status', value: 'finished' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });

    const tempArr: any[] = [];
    const summaries = searchResult.unbundle() as any[];
    console.log('summaries :', JSON.stringify(summaries, null, 2));

    for (const summary of summaries) {
      const practitionerId = summary?.participant?.[0]?.individual?.reference?.replace('Practitioner/', '');

      let fullName = '';
      if (practitionerId) {
        const practitioner = await oystehr.fhir.get<Practitioner>({
          resourceType: 'Practitioner',
          id: practitionerId,
        });
        const firstName = getFirstName(practitioner);
        const lastName = getLastName(practitioner);
        fullName = `${firstName}, ${lastName}`;
      }

      tempArr.push({
        ...summary,
        practitionerName: fullName,
      });
    }

    return lambdaResponse(200, {
      message: `Successfully retrieved summary`,
      summaries: tempArr,
      total: Number(searchResult.total),
    });
  } catch (error: any) {
    console.error('Error:', error);
    return lambdaResponse(500, {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
