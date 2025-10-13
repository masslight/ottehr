import { APIGatewayProxyResult } from 'aws-lambda';
import { Output } from 'utils';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

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

    const searchParams: any[] = [
      ...(body.offset ? [{ name: '_offset', value: body.offset }] : []),
      ...(body.count ? [{ name: '_count', value: body.count }] : []),
      { name: '_total', value: 'accurate' },
      ...(body.patientId ? [{ name: 'patient', value: body.patientId }] : []),
      ...(body.deviceId ? [{ name: '_id', value: body.deviceId }] : []),
      ...(Object.prototype.hasOwnProperty.call(body, 'missing')
        ? [{ name: 'patient:missing', value: body.missing }]
        : []),
    ];

    if (body.search) {
      searchParams.push({ name: 'identifier:contains', value: body.search });
    }

    const locationsResults = await oystehr.fhir.search<any>({
      resourceType: 'Device',
      params: searchParams,
    });

    const response: Output = {
      message: `Successfully retrieved devices details`,
      total: Number(locationsResults.total),
      devices: locationsResults.unbundle(),
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, error.message);
  }
});
