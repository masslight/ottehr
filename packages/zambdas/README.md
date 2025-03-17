# Zambdas

Backend endpoints for the urgent care application.

## Setup

Before you can run locally or deploy, you must copy in the env files from the [ottehr-secrets](https://github.com/masslight/ottehr-secrets) repository. These should be copied into [`.env/`](.env) (e.g. dev: [`.env/dev.json`](.env/dev.json)).

## Run Locally

The backend is run locally using the [Serverless Framework](https://www.serverless.com/framework/docs) with the [Serverless Offline](https://www.npmjs.com/package/serverless-offline) plugin.

Start up the local API Gateway + Zambda emulator with:

```[bash]
npm run start:local
```

## Scripts

Currently available scripts:

### `setup-zapehr-secrets`

Set secrets for each environment.

#### Usage Example

```sh
npm run setup-zapehr-secrets
```

### `deploy-zambdas`

Deploy zambdas for each environment. Calls `npm run package`.

#### Usage Example

```sh
npm run deploy-zambdas
```

## In Case of Emergency

### Single Zambda Deployment Process

These steps are kept here in case you need to deploy an individual zambda manually.

1. Run `npm run package`. This will put deployment zips ready to be uploaded to the zapEHR platform into the `.dist/` folder.
2. Go to the console you want to deploy to (e.g. [testing](https://testing-console.zapehr.com/)).
3. Log in with the appropriate account previously used for 'One Time Setup'.
4. Navigate to /zambdas on the console (e.g. [testing](https://testing-console.zapehr.com/zambdas)).
5. Click on the zambda you are trying to update
6. Click the button "Upload zambda.zip"
7. Select the appropriate zip from the [`.dist/` directory](.dist).
8. Click "Deploy using {zambda-name}.zip"
9. Click the refresh icon and make sure the status is "Active"
