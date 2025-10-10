import fs from 'fs';
import fetch from 'node-fetch';
import { RoleType } from 'utils';
import { allNonPatientRoles, getAuth0Token } from '../shared/';

const updateUserRoles = async (config: any): Promise<void> => {
  const auth0Token = await getAuth0Token(config);
  if (auth0Token === null) {
    throw new Error('could not get Auth0 token');
  }

  console.log('building access policies');

  console.log('searching for existing roles for the project');
  const existingRolesResponse = await fetch(`${config.PROJECT_API}/iam/role`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${auth0Token}`,
    },
  });
  const existingRoles = await existingRolesResponse.json();
  console.log('existingRoles: ', existingRoles);
  if (!existingRolesResponse.ok) {
    throw new Error('Error searching for existing roles');
  }

  let staffUserRoleID = undefined;

  for (const role of allNonPatientRoles) {
    const roleName = role.name;
    let foundRole;
    let roleResJson = undefined;
    if (existingRoles.length > 0) {
      foundRole = existingRoles.find((existingRole: any) => existingRole.name === roleName);
    }
    if (foundRole) {
      console.log(`${roleName} role found: `, foundRole);
      const roleRes = await fetch(`${config.PROJECT_API}/iam/role/${foundRole.id}`, {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${auth0Token}`,
        },
        body: JSON.stringify({ accessPolicy: role.accessPolicy }),
      });
      roleResJson = await roleRes.json();
      if (!roleRes.ok) {
        console.log(roleResJson);
        throw new Error(`Failed to patch role ${roleName}`);
      }
      console.log(`${roleName} role accessPolicy patched: `, roleResJson, JSON.stringify(roleResJson.accessPolicy));
    } else {
      console.log(`creating ${roleName} role`);
      const roleRes = await fetch(`${config.PROJECT_API}/iam/role`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${auth0Token}`,
        },
        body: JSON.stringify({ name: roleName, accessPolicy: role.accessPolicy }),
      });
      roleResJson = await roleRes.json();
      if (!roleRes.ok) {
        console.log(roleResJson);
        throw new Error(`Failed to create role ${roleName}`);
      }
      console.log(`${roleName} role: `, roleResJson, JSON.stringify(roleResJson.accessPolicy));
    }

    if (roleResJson.name === RoleType.Staff) {
      staffUserRoleID = roleResJson.id;
    }
  }

  if (config.ENVIRONMENT === 'production') {
    console.group(`setting defaultSSOUserRole for project to Staff user role ${staffUserRoleID}`);
    const endpoint = `${config.PROJECT_API}/project`;
    console.log('sending to endpoint: ', endpoint);
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${auth0Token}`,
      },
      body: JSON.stringify({ defaultSSOUserRoleId: staffUserRoleID }),
    });
    const responseJSON = await response.json();
    console.log('response', responseJSON);
    if (!response.ok) {
      throw new Error(`Failed to set defaultSSOUserRole`);
    }
  }
};

const main = async (): Promise<void> => {
  const env = process.argv[2];
  const configuration = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  if (!configuration) {
    throw new Error(`could not read environment configuration for .env/${env}.json`);
  }

  await updateUserRoles(configuration);
};

main().catch((error) => {
  console.log(error);
  throw error;
});
