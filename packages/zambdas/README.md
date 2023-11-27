# Zambdas

Back end zambdas for the Ottehr application. These endpoints are responsible for everything from fetching provider profiles to creating and managing video rooms.

## First Time Setup

The rest of this setup guide assumes that you have access to a ZapEHR project and have cloned down a fork of the ottehr repository. If you have not, please follow these steps:

1. Fork Ottehr: https://github.com/masslight/ottehr/fork
2. Copy your fork SSH clone link and `git clone git@github.com:{your_profile}/ottehr.git` in the folder you'd like to use
3. (optional) Add ottehr as upstream `git remote add upstream git@github.com:masslight/ottehr.git`
4. Open repo in editor of your choice, I will use vscode `code .vscode/Ottehr.code-workspace`

Before you continue, please ensure that you have node v18.x and pnpm installed on your machine. We recommend [nvm](https://github.com/nvm-sh/nvm) for managing your node installation and pnpm can be installed with homebrew with this command: `brew install pnpm`.

After you have these dependencies installed, please execute the setup script from the root directory:

```bash
sh scripts/setup.sh
```

You will be asked for this information as input:
- Your access token. Login to your [ZapEHR project](https://console.zapehr.com) and copy the access token from the dashboard.
- Your project ID. You can find this on the [ZapEHR project details page](https://console.zapehr.com)
- Your first provider email. This can be your email.

This script will create various ZapEHR resources that are needed for you to begin development. After the script finishes running, there will be important links highlighted in magenta. You should follow these steps:

1. Find the reset password link in the console output and navigate to the url in your browser. Provide a password.
2. Navigate to `http://localhost:5173/dashboard` and login using the email you provided to the script and the password you chose.
3. Open a new tab and navigate to the waiting room URL. This was output in the script logs and is shown in the provider dashboard. It looks like `http://localhost:5173/{uuid}`
4. Enter your name to act as the patient and begin the call. Grant video/audio permissions.
5. Accept the call from your provider tab.

You should now be on a video call with yourself.

## Run Locally

The back end is run locally using the [Serverless Framework](https://www.serverless.com/framework/docs) with the [Serverless Offline](https://www.npmjs.com/package/serverless-offline) plugin.

Start up the local API Gateway + zambda emulator with:

```sh
pnpm start
```

## Create a New Zambda

1. Create a new folder in [src](./src/) with the name of the zambda in `kebab-case`.
1. Create the `index.ts` file in this folder with these contents:

   ```ts
   import { APIGatewayProxyResult } from 'aws-lambda';
   import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
   import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';

   export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
     return createZambdaFromSkeleton(input, <YOUR_FUNCTION_NAME>);
   };

   interface <YOUR_FUNCTION_NAME>Input {
     <KEY>: <TYPE>;
   }

   const <YOUR_FUNCTION_NAME> = (input: ZambdaFunctionInput): ZambdaFunctionResponse => {
    const { <KEY> } = input.body as <YOUR_FUNCTION_NAME>Input;
   };
   ```

1. Add the zambda's properties to the [deploy script's `ZAMBDAS` constant](./scripts/deploy-zambdas.ts#ZAMBDAS) and the [package script's `ZIP_ORDER` variable](./scripts/package-for-release.sh#ZIP_ORDER).
1. Write your zambda's functionality in the `<YOUR_FUNCTION_NAME>` function.
1. Add the zambda's config to [`severless.yml`](./serverless.yml). Ensure to include any env variables you need in the zambda.

## Scripts

```sh
pnpm <script name>
```

If a script is environment specific, use:

```sh
pnpm <script name>:<env>
```

### `build`

Builds the back end.

### `deploy-zambdas`

Environment specific: `dev`, `dev2`, `testing`, `staging`, `production`.

[Packages](#package) and deploys all zambdas.

### `package`

Packages all zambdas into individual zips ready to be uploaded.

### `start`

Environment specific: `local`, `dev`, `dev2`, `testing`, `staging`.

Starts the back end. If the env is excluded, [defaults to local](#run-locally).

### `setup-zapehr-secrets`

Environment specific: `dev`, `dev2`, `testing`, `staging`, `production`.

Creates or updates all secrets for this env.

Secrets are managed independently from zambda deployments, so each time you add or update secrets in an env, you should run this script.
