/* eslint-disable sort-keys */
import inquirer from 'inquirer';
import { inviteUser } from './invite-user';

async function runCLI(): Promise<void> {
  const questions = [
    { name: 'email', message: 'Enter email:', type: 'input', validate: (input: any) => !!input || 'Email is required' },
    { name: 'title', message: 'Enter title (Mr, Mrs, Ms, Dr):', type: 'input' },
    { name: 'slug', message: 'Enter slug:', type: 'input' },
    { name: 'firstName', message: 'Enter first name:', type: 'input' },
    { name: 'lastName', message: 'Enter last name:', type: 'input' },
    { name: 'secretsPath', message: 'Enter secrets path (default is ../.env/dev.json):', type: 'input' },
    { name: 'applicationId', message: 'Enter ZapEHR application ID:', type: 'input' },
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
