# app

The static frontend web application for Ottehr Patient Portal.

Patients use the application to sign up for and manage appointments. They can do things like schedule new appointments, cancel appointments, reschedule appointments, and fill out paperwork for appointments.

## Run Locally

After completing the steps in the monorepo's top level README.md, you can run locally in a number of different configurations depending on what you are trying to do. All of the ways you can run have their own helper script in package.json which you can run like:

```[bash]
npm run start
```

`start` is the name of the script.

Other scripts for running locally with an explanation of how they work:

- `npm run start` -- Starts the frontend with the `.env.local` env file. The frontend will use your local backend, so make sure it is running.
- `npm run start:local` -- Shortcut for `npm run start`. Starts the frontend with the `.env.local` env file. The frontend will point to our development environment on Oystehr.
- `npm run start:demo` -- Starts the frontend with the `.env.demo` env file. The frontend will point to our development environment on Oystehr.

## Deployment

**Todo this section is out of date**

Deployment is best done using [our deployment action on Github].

Just click `Run workflow` on the right, and fill out the little form.

If you need to deploy from your local machine, read on.

### Before Deploying Locally

In order to deploy, you must set up an aws profile called, with an AWS access / secret key pair for your Ottehr AWS user. Either use the aws CLI, or manually set up the profile in `~/.aws/credentials`.

### Deploy Locally

See package.json for deployment script options. For example,

```[bash]
npm run deploy:demo
```

The deployment script bundles the frontend code, then uploads it to the appropriate bucket on AWS S3, overwriting the previous deployment.

## EHR E2E Tests

For E2E testing documentation and guide please check the [E2E Testing Guide](./tests/e2e-readme/README.md)
