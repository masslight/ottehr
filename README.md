<p align="center">
   <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets-global.website-files.com/653fce065d76f84cf31488ae/6543bdda5daec299834a748e_otter%20logo%20white.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://assets-global.website-files.com/653fce065d76f84cf31488ae/65438838a5f9308ca9498887_otter%20logo%20dark.svg">
      <img alt="Ottehr Logo.">
   </picture>
</p>

<p align="center">The production-ready, open-source EHR</p>

<p align="center">
    <a href="https://www.ottehr.com/"><b>Ottehr.com</b></a>
</p>

<div align="center">

[![Last Commit](https://badgen.net/github/last-commit/masslight/ottehr)](https://github.com/masslight/ottehr/commits/develop)
[![Code Size](https://img.shields.io/github/languages/code-size/masslight/ottehr)](https://github.com/masslight/ottehr)
[![Contributors](https://badgen.net/github/contributors/masslight/ottehr)](https://github.com/masslight/ottehr/graphs/contributors)
[![GitHub Issues](https://badgen.net/github/issues/masslight/ottehr)](https://github.com/masslight/ottehr/issues)
[![GitHub Stars](https://badgen.net/github/stars/masslight/ottehr)](https://github.com/masslight/ottehr/stargazers)
[![GitHub Pull Requests](https://badgen.net/github/prs/masslight/ottehr)](https://github.com/masslight/ottehr/pulls)
![GitHub Pull Requests Closed](https://img.shields.io/github/issues-pr-closed/masslight/ottehr)

</div>

# Ottehr

[Ottehr](https://www.ottehr.com/) is a modern, modular EHR that began as a reference implementation for [Oystehr](https://oystehr.com/). It quickly outgrew "sample EHR" status and became the foundation for large-scale production EHR installations. Ottehr uses Oystehr for back-end service endpoints, and requires a free Oystehr account to run as-is, but you are welcome to modify and use a third-party service vendor or build your own service architecture. Ottehr is designed for developers, hopefully making it easy to fork, white-label, and build entire new classes of EHRs and health-tech products with a fraction of the effort of starting from scratch.

Ottehr consists of two apps,

- **[Ottehr Intake](apps/intake)** &mdash; A patient-facing registration website for creating appointments, initiating telemedicine calls, with features including rescheduling, checking in, completing intake paperwork, text messages and emails, and listing appointments for an account.
- **[Ottehr EHR](apps/ehr/)** &mdash; A staff-facing EHR for managing appointments created, with features including checking appointments, managing patient queues, texting patients, updating a location's slots, setting a location's schedule, joining telemedicine calls, HPI and medical history, exam charting, eRx and Assessment, patient plan, coming soon: RCM and claims submission.

## Run Ottehr Locally

### Prerequisites

To run Ottehr, you'll need a free Oystehr account and Node.js.

#### Get Your Oystehr Account

1. Visit [oystehr.com](https://oystehr.com).
2. Click on **Free Access** to initiate your early access request.

Once your request is received, the Oystehr team will promptly create your account and reach out to you via email.

Check out the [Oystehr Technical Documentation](https://docs.oystehr.com) to learn more about the Oystehr platform.

#### Install Node.js

If you do not already have it, [install Node.js](https://nodejs.org/en/download) v20.x or higher. Ottehr is tested with all active LTS versions.

Ottehr also supports `nvm`, `asdf`, and tools that use `.node-version`.

### Fork & Clone

Fork &mdash;
Go to [https://github.com/masslight/ottehr/fork](https://github.com/masslight/ottehr/fork) and click 'Create fork' to fork the repository.

Clone &mdash; Copy and run the clone script for your fork.

```bash
git clone git@github.com:{your_profile}/ottehr.git
```

Then, move into the new directory

```bash
cd ottehr
```

### Run the Setup Script

```bash
sh scripts/ottehr-setup.sh
```

The script will prompt you for the following information:

- Your access token &mdash; Log in to your Oystehr project on the [Oystehr Console](https://console.oystehr.com), and copy the access token from the dashboard.
- Your project ID &mdash; Listed on the Oystehr Console next to the access token
- An email address for your first Provider User of the EHR &mdash; Put your email here.

When the setup script finishes, the intake and EHR websites will open automatically, and the email address you provided will receive an invitation to join the EHR.

You only need to run the setup script once. To start the apps going forward, use `npm run apps:start`.

### Log in and explore the Patient app

The Patient app starts up at <http://localhost:3002>

By default, the Patient app uses passwordless SMS for authentication. On the login screen, enter your mobile phone number followed by the one-time passcode which is sent to your device.

### Log in and explore the EHR

The EHR app starts up at <http://localhost:4002>

To log into the EHR, check the email address you provided during setup for an invitation to join the EHR application. Click the link, follow the account setup workflow, and then enter your credentials to complete login.

## End to End Test Setup Procedure

Ottehr includes a suite of end to end tests that can be used to maintain quality as you customize it for your use case.

Ottehr uses the [ClickSend](https://www.clicksend.com/us/) api to send an sms with a confirmation code that is used to login before running the e2e tests. As such, you will need to [create a ClickSend account](https://dashboard.clicksend.com/signup/step1) in order to setup e2e testing.

After you have created your ClickSend account, invite a test user to your EHR application by navigating to <https://console.oystehr.com/app/users/new>. Select your EHR application, input the user's email for both "User name" and "Email", set the in-line access policy to

```
{
  "rule": []
}
```

and choose "Administrator" as the role. Then, click "Invite". To set the password, launch the ehr app by running `npm run ehr:start` from the root directory, enter the email you invited, click `Forgot password?` and set a password.

To set the environment files required to run e2e tests, run the following command in the root directory:

```bash
sh scripts/e2e-test-setup.sh
```

The script will prompt you for the following information:

- The username for the test user of the EHR
- The password for a test user of the EHR
- The phone number for a test user of the EHR
- Your ClickSend user's username
- Your ClickSend user's password

Once the program finishes running, the environment files for your e2e tests will be set.

From the root directory, running the following commands will run the e2e tests for the backend and UI for the intake and ehr apps:

```
npm run intake:e2e:local
npm run intake:e2e:local:ui
npm run ehr:e2e:local
npm run ehr:e2e:local:ui
```

## Setting up Terminology Search

Ottehr uses UMLS Terminology Services for searching for ICD-10 and CPT codes.

To set up the terminology search service, please follow these instructions in the [Oystehr docs](https://docs.oystehr.com/services/zambda/examples/terminology-search/#1-get-a-national-library-of-medicine-api-key), and then save the API key as `NLM_API_KEY` in the Zambdas secrets.

## Repository Structure

This repository uses a monorepo structure.

- `apps` &mdash; Frontend web apps
  - intake &mdash; The patient's side
  - ehr &mdash; The provider's side
- `packages/{ehr|intake}/zambdas` &mdash; The application's backend endpoints, deployed on [Oystehr Zambda](https://docs.oystehr.com/services/zambda/).
- `packages/{other folders}` &mdash; Other modules that are imported by apps like `utils`, `ui-components`

## Apps

### EHR App

- [Frontend Documentation](./apps/ehr/README.md)
- [Zambda Documentation](./packages/ehr/zambdas/README.md)
- [E2E Testing Guide](./apps/ehr/test/e2e-readme/README.md)

### Intake App

- [Frontend Documentation](./apps/intake/README.md)
- [Zambda Documentation](./packages/intake/zambdas/README.md)
- [E2E Testing Guide](./apps/intake/tests/e2e-readme/README.md)
