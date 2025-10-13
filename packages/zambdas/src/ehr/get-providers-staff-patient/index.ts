import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;

export const index = wrapHandler(
  'get-providers-staff-patient',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

      const { resourceType } = requestBody;

      if (!resourceType) {
        throw new Error('Missing required parameters: resourceType');
      }

      const secrets = input.secrets;
      if (!oystehrToken) {
        oystehrToken = await getAuth0Token(secrets);
      }
      const oystehr = createOystehrClient(oystehrToken, secrets);

      if (resourceType === 'Practitioner') {
        const searchResult = await oystehr.fhir.search({
          resourceType: 'Practitioner',
          params: [{ name: '_total', value: 'accurate' }],
        });

        const observations = searchResult.unbundle() as any[];

        return lambdaResponse(200, {
          message: `Successfully retrieved vitals`,
          observations: observations,
          total: Number(searchResult.total),
        });
      } else if (resourceType === 'Staff') {
        const searchResult = await oystehr.fhir.search({
          resourceType: 'Staff',
          params: [{ name: '_total', value: 'accurate' }],
        });

        const observations = searchResult.unbundle() as any[];

        return lambdaResponse(200, {
          message: `Successfully retrieved vitals`,
          observations: observations,
          total: Number(searchResult.total),
        });
      } else if (resourceType === 'Patient') {
        const searchResult = await oystehr.fhir.search({
          resourceType: 'Patient',
          params: [{ name: '_total', value: 'accurate' }],
        });

        const observations = searchResult.unbundle() as any[];

        return lambdaResponse(200, {
          message: `Successfully retrieved vitals`,
          observations: observations,
          total: Number(searchResult.total),
        });
      } else {
        throw new Error('Invalid resourceType. Must be one of Practitioner, RelatedPerson, or Patient.');
      }
    } catch (error: any) {
      console.log('Error: ', JSON.stringify(error.message));
      return lambdaResponse(500, error.message);
    }
  }
);
