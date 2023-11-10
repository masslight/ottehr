/* eslint-disable sort-keys */
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';
import { SecretsKeys, getAuth0Token, getSecret } from '../src/shared';
import { Identifier, Practitioner } from 'fhir/r4';

const DEFAULTS = {
  title: 'Dr',
  slug: uuidv4(),
  firstName: 'Olivia',
  lastName: 'Smith',
  secretsPath: '../.env/dev.json',
  applicationId: '1620a91b-4198-4240-ac1c-eadff1e8049d', // Ottehr dev env application id
};

async function inviteUser(
  email: string,
  title = DEFAULTS.title,
  slug = DEFAULTS.slug,
  firstName = DEFAULTS.firstName,
  lastName = DEFAULTS.lastName,
  secretsPath = DEFAULTS.secretsPath,
  applicationId = DEFAULTS.applicationId
): Promise<string> {
  const fullName = `${title} ${firstName} ${lastName}`;
  const secrets = await import(secretsPath); // CONSIDER: checking the secrets file for the correct keys
  const token = await getAuth0Token(secrets);
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  /* TODO
  temp is used because ultimately this does not belong as a patient identifier and should be moved once
  our application matures to use more billing-related resources
  */
  const identifier: Identifier = { assigner: { display: 'ottehr-provider-slug' }, value: slug, use: 'temp' };

  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    active: true,
    identifier: [identifier],
    name: [{ text: fullName, family: lastName, given: [firstName], prefix: [title] }],
    telecom: [
      {
        system: 'email',
        value: email,
      },
    ],
  };

  const invitedUserResponse = await fetch(`${PROJECT_API}/user/invite`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      email: email,
      username: fullName,
      applicationId: applicationId,
      resource: practitioner,
      accessPolicy: {
        rule: [{ action: '*', resource: '*', effect: 'Allow' }],
      },
    }),
  });

  if (!invitedUserResponse.ok) {
    console.log(await invitedUserResponse.json());
    throw new Error('Failed to create user');
  }

  const invitedUser = await invitedUserResponse.json();
  return invitedUser.invitationUrl;
}

async function runCLI(): Promise<void> {
  const questions = [
    { name: 'email', message: 'Enter email:', type: 'input', validate: (input: any) => !!input || 'Email is required' },
    { name: 'title', message: 'Enter title (Mr, Mrs, Ms, Dr):', type: 'input' },
    { name: 'slug', message: 'Enter slug:', type: 'input' },
    { name: 'firstName', message: 'Enter first name:', type: 'input' },
    { name: 'lastName', message: 'Enter last name:', type: 'input' },
    { name: 'secretsPath', message: 'Enter secrets path (default is ../.env/dev.json):', type: 'input' },
    { name: 'applicationId', message: 'Enter zapEHR application ID:', type: 'input' },
  ];
  const answers = await inquirer.prompt(questions);
  // TODO: add check that slug is available, if slug unavailable, prompt user to enter a new slug
  const invitationUrl = await inviteUser(
    answers.email,
    answers.title || undefined,
    answers.slug || undefined,
    answers.firstName || undefined,
    answers.lastName || undefined,
    answers.secretsPath || undefined, // CONSIDER: checking that there is a file at this path
    answers.applicationId || undefined
  );
  console.log(
    `User with email ${answers.email} can gain access to their account by navigating to URL ${invitationUrl}`
  );
}

runCLI().catch((error) => console.error(error));
