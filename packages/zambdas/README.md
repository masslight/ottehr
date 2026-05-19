# Ottehr Backend

Backend endpoints for Ottehr, deployed on [Oystehr Zambda](https://docs.oystehr.com/oystehr/services/zambda/).

## Setup

Before you can run locally or deploy, you must have the necessary .env files in the `/config/.env` directory. Learn more in the [config README](./apps/intake/README.md).

## Run Locally

The backend is run locally using a [small Express server](/packages/zambdas/src/local-server/index.ts).

Start up the local Zambda service emulator with:

```[bash]
npm run start
```
