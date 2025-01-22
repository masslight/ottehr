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

This monorepo contains code for [Ottehr telehealth](https://www.ottehr.com/).

Ottehr is a modern, modular EHR that began as a reference implementation for [Oystehr](https://oystehr.com). It quickly outgrew "sample EHR" status and became the foundation for large-scale production EHR installations. Ottehr uses Oystehr for back-end service endpoints, and requires a free Oystehr account to run as-is, but you are welcome to modify and use a third-party service vendor or build your own service architecture. Ottehr is designed for developers, hopefully making it easy to fork, white-label, and build entire new classes of EHRs and health-tech products with a fraction of the effort of starting from scratch.

## Repository Structure

This repository uses a monorepo structure.

- `apps` - frontend web apps (intake and ehr web app)
- `packages/{ehr|intake}/zambdas` - The application's backend endpoints
- `packages/{other folders}` - other modules that are imported by apps like `utils`, `ui-components`

## Setup

Ottehr currently has two websites. One is for patients -- **Ottehr Intake** -- and one is for staff -- **Ottehr EHR**.

- **[Ottehr Intake](apps/intake):** A patient-facing registration website for creating appointments, with features including rescheduling, checking in, text messages and emails, and listing appointments for an account
- **[Ottehr EHR](packages/ehr/):** A staff-facing EHR for managing appointments created, with features including checking appointments, managing patient queues, texting patients, updating a location's slots, setting a location's schedule, joining telemedicine calls, HPI and medical history, exam charting, eRx and Assessment, patient plan, coming soon: RCM and claims submission

## First Time Setup

To run Ottehr for the first time, you need to set up the project.

#### For Windows users:

We recommend using the Windows Subsystem for Linux (WSL) to run Ottehr on Windows. Follow these steps to set up WSL and install Node.js:

1.  Install **WSL** by following the official Microsoft guide: [Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

2.  Open your **WSL** terminal and follow the instructions below to install nvm and Node.js.

### Node Installation

To manage Node.js versions efficiently, we recommend using [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm#installing-and-updating).

1. Install nvm by following the instructions provided [here](https://github.com/nvm-sh/nvm#installing-and-updating).

2. Use nvm to install Node.js version 18 with the following commands:

   ```bash
   nvm install 18
   ```

3. Set Node.js version 18 as the default with:

   ```bash
   nvm alias default 18
   ```

After successful installation, verify the setup by executing:

```bash
node -v
```

This command should display the installed Node.js version.

### Joining Oystehr

You'll need a free Oystehr account to run Ottehr. Register for access at [oystehr.com](https://oystehr.com). Follow these simple steps:

1. Visit [oystehr.com](https://oystehr.com).
2. Click on **Free Access** to initiate your early access request.

Once your request is received, the Oystehr team will promptly reach out to you via email, providing the credentials you need to kickstart your Oystehr journey.

For comprehensive guidance on getting started with Oystehr, explore our technical documentation available at [https://docs.oystehr.com](https://docs.oystehr.com).

## Setup Procedure

To proceed with this setup guide, it is assumed that you have access to an Oystehr project. If you have done so, please follow these steps:

1. **Fork Ottehr:**
   Visit [https://github.com/masslight/ottehr/fork](https://github.com/masslight/ottehr/fork) and fork the repository.

2. **Clone Your Fork:**
   Copy the SSH clone link of your fork and execute the following command in your preferred folder:

   ```bash
   git clone git@github.com:{your_profile}/ottehr.git
   ```

3. (Optional) **Add Ottehr as Upstream:**
   If desired, add the original Ottehr repository as an upstream remote:

   ```bash
   git remote add upstream git@github.com:masslight/ottehr.git
   ```

4. **Open Repository in Your Editor:**
   Open the repository in your chosen editor; for example, in VSCode:

   ```bash
   code .vscode/Ottehr.code-workspace
   ```

Before proceeding, ensure that you have Node.js v18.x and pnpm installed on your machine.

**For Windows users, make sure you have WSL set up and are running these commands in your WSL terminal.**

Once these dependencies are in place, enter the following command from the root directory.

```bash
sh scripts/ottehr-setup.sh
```

**note**: If you encounter an error on WSL/Ubuntu, try using bash instead of sh:

```bash
bash scripts/ottehr-setup.sh
```

The script will prompt you for the following information:

- Your access token: Log in to your Oystehr project on the [Oystehr Console](https://console.oystehr.com), and copy the access token from the dashboard
- Your project ID: Listed on the Oystehr Console next to the access token
- Your first provider email: This can be your email address

Once the program finishes running,

1. The Intake and EHR websites will open.
1. To log in to the EHR, enter the email you input during the setup program. Click `Forgot password?` and set a password then log in.

The URL for a test location is <http://localhost:3002/prebook/in-person?bookingOn=testing2&scheduleType=group>.

The setup script only has to be run once. After you have run it you can use the following command to launch the apps:
`npm run apps:start`

### e2e Test Setup Procedure

Ottehr uses the [ClickSend](https://www.clicksend.com/us/) api to send an sms with a confirmation code that is used to login before running the e2e tests. As such, you will need to [create a ClickSend account](https://dashboard.clicksend.com/signup/step1) in order to setup e2e testing.

After you have created your ClickSend account, invite a test user to your EHR application by navigating to https://console.oystehr.com/app/users/new. Select your EHR application, input the user's email for both "User name" and "Email", set the access policy to

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

### npm install

run `npm ci` at the top level to install dependencies for all packages in the monorepo.

### Set up env files

In each `packages/*/zambdas/` folder copy `.env` folder from corresponding folder in secrets repo (`ottehr-secrets` for now still)

To set up the terminology search service, please follow these instructions in the [Oystehr docs](https://docs.oystehr.com/services/zambda/examples/terminology-search/#1-get-a-national-library-of-medicine-api-key), and then paste the API key as the `NLM_API_KEY` in the Zambdas secrets.

### Start up the frontend or backend

In the root directory you have some turborepo scripts that can be run to instantiate any app with one command, check the root `package.json` to know more. For example: `npm run ehr:start` will start UI app and zambdas for EHR part.

## Apps

### EHR App

- [Frontend Documentation](./apps/ehr/README.md)
- [Zambda Documentation](./packages/ehr/zambdas/README.md)
- [E2E Testing Guide](./apps/ehr/test/e2e-readme/README.md)

### Intake App

- [Frontend Documentation](./apps/intake/README.md)
- [Zambda Documentation](./packages/intake/zambdas/README.md)
- [E2E Testing Guide](./apps/intake/tests/e2e-readme/README.md)
