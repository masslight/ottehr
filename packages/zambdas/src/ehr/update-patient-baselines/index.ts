import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;

export const index = wrapHandler(
  'update-patient-baselines',
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

      const { patientId, component } = requestBody;

      if (!patientId) {
        throw new Error('Missing required parameters: patientId');
      }
      if (!component || !Array.isArray(component)) {
        throw new Error('Missing required parameter: component (must be an array)');
      }

      const secrets = input.secrets;
      if (!oystehrToken) {
        oystehrToken = await getAuth0Token(secrets);
      }
      const oystehr = createOystehrClient(oystehrToken, secrets);

      const observationResult = await oystehr.fhir.search({
        resourceType: 'Observation',
        params: [
          { name: 'patient', value: `Patient/${patientId}` },
          { name: '_sort', value: '-date' },
          { name: 'category', value: 'survey' },
          { name: '_count', value: '1' },
        ],
      });

      const observations = observationResult.unbundle()[0] as any;

      if (!observations) {
        const createObservation = await createPatientBaseline(oystehr, patientId, component);
        return lambdaResponse(200, {
          message: `Successfully created baselines`,
          observations: createObservation,
          total: 1,
        });
      } else {
        const updatedObservation = {
          ...observations,
          component,
          meta: {
            ...observations.meta,
            lastUpdated: new Date().toISOString(),
          },
        };

        console.log('Updated observation without threshold components:', JSON.stringify(updatedObservation, null, 2));

        await oystehr.fhir.update(updatedObservation);
        return lambdaResponse(200, {
          message: `Successfully updated baselines`,
          observations: updatedObservation,
          total: 1,
        });
      }
    } catch (error: any) {
      console.error('Error:', error);
      return lambdaResponse(500, {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
);

async function createPatientBaseline(oystehr: Oystehr, patientId: string, component: any): Promise<any> {
  return await oystehr.fhir.create<any>({
    resourceType: 'Observation',
    status: 'final',
    subject: {
      type: 'Patient',
      reference: `Patient/${patientId}`,
    },
    code: {
      text: 'Threshold Details',
    },
    component: component,
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
          },
        ],
      },
    ],
  });
}
