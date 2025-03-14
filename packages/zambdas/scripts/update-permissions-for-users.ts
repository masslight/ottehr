import fs from 'fs';
import fetch from 'node-fetch';
import { getAuth0Token } from '../src/shared';

const updatePermissionsFromZambdaList = async (zambdaList: string[], config: any): Promise<void> => {
  const auth0Token = await getAuth0Token(config);
  if (auth0Token === null) {
    throw new Error('could not get Auth0 token');
  }
  console.log('building access policy');
  const AccessPolicy = {
    rule: [
      {
        resource: zambdaList.map((zambda) => `Zambda:Function:${zambda}`),
        action: ['Zambda:InvokeFunction'],
        effect: 'Allow',
      },
      // fhir is implicitly denied
    ],
  };
  console.log('searching for exisiting roles for the project');
  const existingRoles = await fetch(`${config.PROJECT_API}/iam/roles`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${auth0Token}`,
    },
  });
  const rolesData = await existingRoles.json();
  console.log('existingRoles: ', rolesData);
  let patientRole;
  if (rolesData.length > 0) {
    patientRole = rolesData.find((role: any) => role.name === 'Patient');
  }
  if (patientRole) {
    console.log('patient role found: ', patientRole);
    const patientRoleRes = await fetch(`${config.PROJECT_API}/iam/roles/${patientRole.id}`, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${auth0Token}`,
      },
      body: JSON.stringify({ accessPolicy: AccessPolicy }),
    });
    patientRole = await patientRoleRes.json();
    console.log('patientRole inlineAccessPolicy patch: ', patientRole);
  } else {
    console.log('creating patient role');
    const patientRoleRes = await fetch(`${config.PROJECT_API}/iam/roles`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${auth0Token}`,
      },
      body: JSON.stringify({ name: 'Patient', accessPolicy: AccessPolicy }),
    });
    patientRole = await patientRoleRes.json();
    console.log('patientRole: ', patientRole);
  }
  console.group('setting default patient role for project');
  const endpoint = `${config.PROJECT_API}/project`;
  console.log('sending to endpoint: ', endpoint);
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${auth0Token}`,
    },
    body: JSON.stringify({ defaultPatientRoleId: patientRole.id, signupEnabled: true }),
  });

  const resData = await response.json();
  console.log('response json: ', resData);
  console.groupEnd();
  if (response.status === 200) {
    console.log('successfully updated default patient role');
  } else {
    throw new Error('Failed to update default patient role');
  }

  return;
};

const main = async (): Promise<void> => {
  const env = process.argv[2];

  const envAuthZambdas: string[] = [];
  const config = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  if (config.CREATE_APPOINTMENT_ZAMBDA_ID && config.GET_PATIENTS_ZAMBDA_ID && config.GET_APPOINTMENTS_ZAMBDA_ID) {
    envAuthZambdas.push(config.CREATE_APPOINTMENT_ZAMBDA_ID);
    envAuthZambdas.push(config.GET_PATIENTS_ZAMBDA_ID);
    envAuthZambdas.push(config.GET_APPOINTMENTS_ZAMBDA_ID);
  } else {
    throw new Error('CREATE_APPOINTMENT_ZAMBDA_ID, GET_PATIENTS_ZAMBDA_ID, GET_APPOINTMENTS_ZAMBDA_ID must be defined');
  }

  if (!envAuthZambdas || envAuthZambdas.length === 0) {
    throw new Error('Issue getting authorized zambdas for this environment');
  }

  if (!config) {
    throw new Error('could not set environment properly');
  }

  await updatePermissionsFromZambdaList(envAuthZambdas, config);
};

main().catch((error) => {
  console.log(error);
  throw error;
});
