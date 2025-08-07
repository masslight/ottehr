import { APIGatewayProxyResult } from 'aws-lambda';
import { GetDevicesResponse } from 'utils';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

// For local development it makes it easier to track performance
if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

let oystehrToken: string;
export const index = wrapHandler('get-devices', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const body = JSON.parse(input.body as any);
    const secrets = input.secrets;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);
    const locationsResults = await oystehr.fhir.search<any>({
      resourceType: 'Device',
      params: [
        { name: '_offset', value: body.offset },
        { name: '_count', value: body.count },
        { name: '_total', value: 'accurate' },
        ...(body.patientId ? [{ name: 'patient', value: body.patientId }] : []), // 'Patient/1b1c9771-3da5-4798-aff9-0cea267b62bf'
        ...(Object.prototype.hasOwnProperty.call(body, 'missing')
          ? [{ name: 'patient:missing', value: body.missing }]
          : []),
      ],
    });
    console.log('Total : ', locationsResults.total);

    const response: GetDevicesResponse = {
      message: `Successfully retrieved devices details`,
      devices: locationsResults.unbundle(),
      total: Number(locationsResults.total),
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, error.message);
  }
});
