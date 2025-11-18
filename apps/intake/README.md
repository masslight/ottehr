# Ottehr Patient Portal

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

## Patient Portal E2E Tests

For E2E testing documentation and guide please check the [E2E Testing Guide](./tests/e2e-readme/README.md)
