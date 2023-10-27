# Zambdas

Back end zambdas for the Ottehr application. These endpoints are responsible for everything from fetching provider profiles to creating and managing video rooms.

## Setup

Before you can run locally or deploy, you must copy in the env files from the [ottehr-secrets](https://github.com/masslight/ottehr-secrets) repository. These should be copied into [`.env/`](.env) (e.g. dev: [`.env/dev.json`](.env/dev.json)).

## Run Locally

The back end is run locally using the [Serverless Framework](https://www.serverless.com/framework/docs) with the [Serverless Offline](https://www.npmjs.com/package/serverless-offline) plugin.

Start up the local API Gateway + zambda emulator with:

```sh
pnpm start
```

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

Environment specific: `dev`, `testing`, `staging`, `production`.

[Packages](#package) and deploys all zambdas.

### `package`

Packages all zambdas into individual zips ready to be uploaded.

### `start`

Environment specific: `local`, `dev`, `testing`, `staging`.

Starts the back end. If the env is excluded, [defaults to local](#run-locally).

### `setup-zapehr-secrets`

Environment specific: `dev`, `testing`, `staging`, `production`.

Creates or updates all secrets for this env.

Secrets are managed independently from zambda deployments, so each time you add or update secrets in an env, you should run this script.
