# app

The static frontend web application for ottEHR.

## Run Locally

After completing the steps in the monorepo's top level README.md, you can run locally in a number of different configurations depending on what you are trying to do. All of the ways you can run have their own helper script in package.json which you can run like:

```[bash]
pnpm run start
```

`start` is the name of the script.

Other scripts for running locally with an explanation of how they work:

- `pnpm run start` -- Starts the frontend with the `local.env.js` env file. The frontend will use your local backend, so make sure it is running.
- `pnpm run start:dev` -- Starts the frontend with the `dev.env.js` env file. The frontend will point to our development environment on zapEHR.
- `pnpm run start:testing` -- Starts the frontend with the `testing.env.js` env file. The frontend will point to our testing environment on zapEHR.
- `pnpm run start:staging` -- Starts the frontend with the `testing.env.js` env file. The frontend will point to our staging environment on zapEHR.
- `pnpm run start:local-to-zapehr-local` -- Starts the frontend with the `local-to-zapehr-local.env.js` env file. The frontend will use your locally running zapEHR platform, so make sure it is running.

## Deployment

**Todo this section is out of date**

### Before Deploying Locally

In order to deploy, you must set up an aws profile called, `TODO`, with an AWS access / secret key pair for your AWS user. Either use the aws CLI, or manually set up the profile in `~/.aws/credentials`.

### Deploy Locally

See package.json for deployment script options. For example,

```[bash]
pnpm run deploy:development
```

The deployment script bundles the frontend code, then uploads it to the appropriate bucket on AWS S3, overwriting the previous deployment.
