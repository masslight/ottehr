import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner, Resource } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { getResourcesFromBatchInlineRequests } from 'utils';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;

export const index = wrapHandler(
  'get-provider-staff-patient',
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

        const practitionerIds = providerList.map((u) => u.profile.split('/')[1]);
        const resources = (await getResourcesFromBatchInlineRequests(oystehr, [
          `Practitioner?_id=${practitionerIds.join(',')}&_elements=id,name`,
        ])) as Resource[];
        console.log('Provider Resource:', JSON.stringify(resources, null, 2));
        providerList = providerList.map((user) => {
          const practitioner = resources.find((r) => r.id === user.profile.split('/')[1]) as Practitioner | undefined;
          return {
            ...user,
            firstName: practitioner?.name?.[0]?.given?.join(' ') ?? '',
            lastName: practitioner?.name?.[0]?.family ?? '',
            providerId: practitioner?.id,
          };
        });

        return lambdaResponse(200, {
          message: `Successfully retrieved providers`,
          providerList,
        });
      } else if (resourceType === 'Staff') {
        const roles = (await oystehr.role.list()).filter((x: any) => ['Staff'].includes(x.name));
        let staffList: any[] = [];
        for (const role of roles) {
          const users = await fetchUsers(oystehrToken, PROJECT_ID, role.id);
          staffList = [...staffList, ...users.data];
        }
        staffList = getUniqueById(staffList);

        const practitionerIds = staffList.map((u) => u.profile.split('/')[1]);
        const resources = (await getResourcesFromBatchInlineRequests(oystehr, [
          `Practitioner?_id=${practitionerIds.join(',')}&_elements=id,name`,
        ])) as Resource[];

        staffList = staffList.map((user) => {
          const practitioner = resources.find((r) => r.id === user.profile.split('/')[1]) as Practitioner | undefined;
          return {
            ...user,
            firstName: practitioner?.name?.[0]?.given?.join(' ') ?? '',
            lastName: practitioner?.name?.[0]?.family ?? '',
            staffId: practitioner?.id,
          };
        });

        return lambdaResponse(200, {
          message: `Successfully retrieved staff`,
          staffList,
        });
      } else if (resourceType === 'Patient') {
        const roles = (await oystehr.role.list()).filter((x: any) => ['Patient'].includes(x.name));
        let patientList: any[] = [];
        for (const role of roles) {
          const users = await fetchUsers(oystehrToken, PROJECT_ID, role.id);
          patientList = [...patientList, ...users.data];
        }
        patientList = getUniqueById(patientList);

        const patientIds = patientList.map((u) => u.profile.split('/')[1]);
        const resources = (await getResourcesFromBatchInlineRequests(oystehr, [
          `Patient?_id=${patientIds.join(',')}&_elements=id,name`,
        ])) as Resource[];
        console.log('Patient Resource:', JSON.stringify(resources, null, 2));
        patientList = patientList.map((user) => {
          const patient = resources.find((r) => r.id === user.profile.split('/')[1]) as any;
          return {
            ...user,
            firstName: patient?.name?.[0]?.given?.join(' ') ?? '',
            lastName: patient?.name?.[0]?.family ?? '',
            patientId: patient?.id,
          };
        });

        return lambdaResponse(200, {
          message: `Successfully retrieved patients`,
          patientList,
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
