import Oystehr from '@oystehr/sdk';
import fs from 'fs';
import { RoleType } from 'utils';
import { checkOrCreateM2MClientToken, getAuth0Token, updateUserRoles } from '../shared/';

const updateUserRolesScript = async (config: any): Promise<void> => {
  const auth0Token = await getAuth0Token(config);
  if (auth0Token === null) {
    throw new Error('could not get Auth0 token');
  }
  const token = await checkOrCreateM2MClientToken(auth0Token, config);
  const oystehr = new Oystehr({
    accessToken: token,
    projectId: config.PROJECT_ID,
    services: {
      fhirApiUrl: config.FHIR_API,
      projectApiUrl: config.PROJECT_API,
    },
  });

  const allRoleIds = await updateUserRoles(oystehr);
  const staffUserRoleID = allRoleIds[RoleType.Staff];

  if (config.ENVIRONMENT === 'production') {
    console.group(`setting defaultSSOUserRole for project to Staff user role ${staffUserRoleID}`);
    try {
      await oystehr.project.update({ defaultSSOUserRoleId: staffUserRoleID });
    } catch (error) {
      console.log('error', error);
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

  await updateUserRolesScript(configuration);
};

main().catch((error) => {
  console.log(error);
  throw error;
});
