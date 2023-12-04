# Zambdas

Back end zambdas for the Ottehr application. These endpoints are responsible for everything from fetching provider profiles to creating and managing video rooms.

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
