# Zambdas

Backend endpoints for the Ottehr application. These endpoints are responsible for everything from fetching appointment slots for the patient to select from, to booking the appointment, and syncing data from our zapEHR project to eClinicalWorks.

## Setup

Before you can run locally or deploy, you must copy in the env files from the [TODO-secrets](https://github.com/masslight/TODO-secrets) repository. These should be copied into [`.env/`](.env) (e.g. dev: [`.env/dev.json`](.env/dev.json)).

## Run Locally

The backend is run locally using the [Serverless Framework](https://www.serverless.com/framework/docs) with the [Serverless Offline](https://www.npmjs.com/package/serverless-offline) plugin.

Start up the local API Gateway + Zambda emulator with:

```[bash]
pnpm run start:local
```

## Redox

To connect with eClinicalWorks, we use Redox, a platform for connecting to EHRs. Here are zambdas that work with Redox:

- **`redox-patient`:** A subscription zambda, when an Appointment is created in FHIR, `redox-patient` is called. This function:
  - Checks if the appointment has already been sent to Redox. If it has, it returns.
  - Gets the Patient who booked the Appointment.
  - Searches Redox for patients with the first name, last name, and date of birth.
    - If there is not a match, it creates a new patient to send to Redox.
    - If there is one match, it updates a patient to send to Redox.
    - If there are multiple matches, it exits.
  - Calls Redox based on the above conditions.
- **`redox-patient-updated-webhook`:** A public zambda that is called by Redox. This function:
  - Checks that the request is from Redox.
  - Takes in a RedoxPatient as input.
  - Searches zapEHR for FHIR resources related to the patient and appointment using the RedoxPatient's ID.
  - Creates a new appointment in Redox.
  - Marks that the appointment was sent to Redox in zapEHR FHIR — refer to the `redox-patient` steps.
- **`redox-patient-appointment-status`:** A subscription zambda, when an Appointment status changes, `redox-patient-appointment-status` is called. This function:
  - Calls Redox to update the appointment status.
- **`redox-patient-send-document`** A subscription zambda, when a DocumentReference is created, `redox-patient-send-document` sends the document to Redox.
  - Calls Redox to send a document stored in zapEHR Z3. Documents are created for:
    - a patient adds an image of their ID front and back.
    - a patient adds an image of their insurance card front and back.
    - a patient signs the consent forms for an appointment and we create a PDF for each form.

### Secrets One Time Setup

In the zapEHR Platform, secrets are managed managed independently from Zambda deployments using CRUD endpoints from the Platform API. As part of one-time setup for an environment's deployment, you must create all of the secrets so that the zapEHR platform can pass them to the code securely.

Run `pnpm run setup-zapehr-secrets`. This interactive script will create or update all of the secrets.

### Zambdas One Time Setup

1. Go to the console you want to deploy to (e.g. [testing](https://testing-console.zapehr.com/)).
2. Create or log in with the appropriate account.
3. Navigate to /zambdas on the console (e.g. [testing](https://testing-console.zapehr.com/zambdas)).
4. Create a zambda by entering the name of the zambda you want to create and clicking the "+" button.
5. Find the zambda ID from the URL on zapehr (e.g. for `https://testing-console.zapehr.com/zambdas/4250874c-6cc3-49b2-ba6e-64537a172e43` the zambda ID is `4250874c-6cc3-49b2-ba6e-64537a172e43`).
6. Update the zambda ID in the relevant env files (e.g. [testing frontend](../app/env/testing.env.js), [testing backend in secrets repo](https://github.com/masslight/ottehr-secrets/blob/main/bh-zambdas/testing.json)).
7. If the zambda needs to be public, you'll need access to the zapehr database since there is no endpoint to change the zambda access right now. If you don't have access, please contact someone to get it.
   1. **!!!!! Be careful doing these steps !!!!! You are editing the database directly, and, if in production, may accidentally change other users' rows.** Hopefully by the time we release zapEHR production there will be an endpoint to update zambda status so these steps will not be necessary.
   2. Connect to the zapehr database. This README uses pgAdmin.
   3. Right click the "platform_Lambda" table and select "View/Edit Data -> All Rows".
   4. Find the row for the zambda using the zambda ID, and double click the cell for `trigger_method`. Its value should be `http_auth`. Change its value to `http_open` and click the save button (on Mac you can do Fn+F6).

### Deploy all Zambdas

Run `pnpm run deploy-zambdas`. This command packages and deploys all zambdas.

## Scripts

Currently available scripts:

### `create-subscription`

**TODO describe function**

#### Usage Example

```sh
pnpm run create-subscription:dev
```

### `setup-zapehr-secrets`

Set secrets for each environment.

#### Usage Example

```sh
pnpm run setup-zapehr-secrets
```

### `deploy-zambdas`

Deploy zambdas for each environment. Calls `pnpm run package`.

#### Usage Example

```sh
pnpm run deploy-zambdas
```

## In Case of Emergency

### Single Zambda Deployment Process

These steps are kept here in case you need to deploy an individual zambda manually.

1. Run `pnpm run package`. This will put deployment zips ready to be uploaded to the zapEHR platform into the `.dist/` folder.
2. Go to the console you want to deploy to (e.g. [testing](https://testing-console.zapehr.com/)).
3. Log in with the appropriate account previously used for 'One Time Setup'.
4. Navigate to /zambdas on the console (e.g. [testing](https://testing-console.zapehr.com/zambdas)).
5. Click on the zambda you are trying to update
6. Click the button "Upload zambda.zip"
7. Select the appropriate zip from the [`.dist/` directory](.dist).
8. Click "Deploy using {zambda-name}.zip"
9. Click the refresh icon and make sure the status is "Active"
