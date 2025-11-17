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

    const locationsResults = await oystehr.fhir.search<any>({
      resourceType: 'Device',
      params: searchParams,
    });

    let devices = locationsResults.unbundle();

    if (body.search) {
      devices = devices.filter(
        (device: any) =>
          device.identifier?.some((id: any) => id.value?.toLowerCase().includes(body.search.toLowerCase()))
      );
    }

    if (body.count) {
      devices = devices.slice(0, Number(body.count));
    }

    const response: Output = {
      message: `Successfully retrieved devices details`,
      total: devices.length,
      devices,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, error.message);
  }
});
