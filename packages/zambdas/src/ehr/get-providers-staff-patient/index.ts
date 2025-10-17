import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
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
      const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

      if (resourceType === 'Provider') {
        const roles = (await oystehr.role.list()).filter((x: any) => ['Provider'].includes(x.name));
        let providerList: any[] = [];
        for (const role of roles) {
          const users = await fetchUsers(oystehrToken, PROJECT_ID, role.id);
          providerList = [...providerList, ...users.data];
        }
        providerList = getUniqueById(providerList);

        return lambdaResponse(200, {
          message: `Successfully retrieved providers`,
          providerList: providerList,
        });
      } else if (resourceType === 'Staff') {
        const roles = (await oystehr.role.list()).filter((x: any) => ['Staff'].includes(x.name));
        let staffList: any[] = [];
        for (const role of roles) {
          const users = await fetchUsers(oystehrToken, PROJECT_ID, role.id);
          staffList = [...staffList, ...users.data];
        }
        staffList = getUniqueById(staffList);

        return lambdaResponse(200, {
          message: `Successfully retrieved staff`,
          staffList: staffList,
        });
      } else if (resourceType === 'Patient') {
        const roles = (await oystehr.role.list()).filter((x: any) => ['Patient'].includes(x.name));
        let patientList: any[] = [];
        for (const role of roles) {
          const users = await fetchUsers(oystehrToken, PROJECT_ID, role.id);
          patientList = [...patientList, ...users.data];
        }
        patientList = getUniqueById(patientList);

        return lambdaResponse(200, {
          message: `Successfully retrieved patients`,
          patientList: patientList,
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

async function fetchUsers(token: string, projectId: string, roleId: string): Promise<any> {
  const mioRes = await fetch(`https://project-api.zapehr.com/v1/user/v2/list?roleId=${roleId}&limit=1000`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'x-oystehr-project-id': projectId,
    },
  });

  if (!mioRes.ok) {
    throw new Error(`Failed to fetch users by role: ${mioRes.statusText}`);
  }

  const data: any = await mioRes.json();
  return data;
}

function getUniqueById(array: any): any {
  const seen = new Set();
  return array.filter((item: any) => {
    if (seen.has(item.profile)) {
      return false;
    }
    seen.add(item.profile);
    return true;
  });
}
