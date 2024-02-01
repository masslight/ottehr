<p align="center">
   <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets-global.website-files.com/653fce065d76f84cf31488ae/6543bdda5daec299834a748e_otter%20logo%20white.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://assets-global.website-files.com/653fce065d76f84cf31488ae/65438838a5f9308ca9498887_otter%20logo%20dark.svg">
      <img alt="Ottehr Logo.">
   </picture>
</p>

<p align="center">The production-ready, open-source EHR.</p>

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

Ottehr is a modern, modular EHR that began as a reference implementation for [ZapEHR](https://zapehr.com). It quickly outgrew "sample EHR" status and became the foundation for large-scale production EHR installations. Ottehr uses ZapEHR for back-end service endpoints, and requires a free ZapEHR account to run as-is, but you are welcome to modify and use a third-party service vendor or build your own service architecture. Ottehr is designed for developers, hopefully making it easy to fork, white-label, and build entire new classes of EHRs and health-tech products with a fraction of the effort of starting from scratch.

## Setup

Ottehr currently has a few components:

* A patient-facing registration website for creating appointments, with features including rescheduling, checking in, sending text messages and emails, and listing appointments for an account
* A staff-facing EHR for managing appointments created through the patient website, with features including checking appointments, texting patients, updating a location's slots, and setting a location's schedule
* A telemed website for creating appointments with patients and hosting calls
* A components React library for creating healthcare applications

To set up the first two components, we have a setup program you can run.

## First Time Setup

For a sample guide of setting up Ottehr Telemedicine, please check [getting started with ottehr](https://youtu.be/NJzF9Nzhbeo).

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

### Installing `pnpm`

To manage Node.js packages, we recommend using [pnpm](https://pnpm.io/).

#### Using Homebrew or NPM (macOS/Linux):

The easiest way to get started is to use the [brew](https://brew.sh/) or [npm](https://www.npmjs.com/) command:
```bash
brew install pnpm
```
OR
```bash
npm install -g pnpm
```

#### Manual Installation

Alternatively, you can install `pnpm` using the [official documentation](https://pnpm.io/installation).

### Joining ZapEHR

You'll need a free ZapEHR account to run Ottehr. Register for access at [zapehr.com](https://zapehr.com). Follow these simple steps:

1. Visit [zapehr.com](https://zapehr.com).
2. Click on **Free Access** to initiate your early access request.

Once your request is received, the ZapEHR team will promptly reach out to you via email, providing the credentials you need to kickstart your ZapEHR journey.

For comprehensive guidance on getting started with ZapEHR, explore our technical documentation available at [https://docs.zapehr.com/docs/welcome](https://docs.zapehr.com/docs/welcome).

## Setup Procedure

To proceed with this setup guide, it is assumed that you have access to a ZapEHR project. If you have done so, please follow these steps:

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

Before proceeding, ensure that you have [Node.js](#node) v18.x and [pnpm](#installing-pnpm) installed on your machine.

Once these dependencies are in place, execute the setup script from the root directory.

If you would like to set up Ottehr Intake and Ottehr EHR:

```bash
sh scripts/interactive-setup.sh
```

If you would like to set up Ottehr telehealth:

```bash
sh scripts/setup.sh
```

The script will prompt you for the following information:

* Your access token: Log in to your [ZapEHR project](https://console.zapehr.com), and copy the access token from the dashboard.
* Your project ID: Find this on the [ZapEHR project details page](https://console.zapehr.com/project).
* Your first provider email: This can be your email address.

Upon completion, the script will generate important links. Follow these steps:

### Ottehr Intake and Ottehr EHR

1. The Intake and EHR websites will open.
1. To log in to the EHR, locate the reset password link in the console output and visit the provided URL in your browser to set a password. You might be redirected to a page that does not load, if so change the URL to <http://localhost:3200> and it should load. If you prefer to use the website, you can click `Forgot password?` on the website that loads and set a password.

### Ottehr telehealth

1. Locate the reset password link in the console output and visit the provided URL in your browser to set a password.
1. Go to `http://localhost:5173/dashboard` and log in using the email provided to the script and the chosen password.
1. Open a new tab and visit the waiting room URL, as output in the script logs (e.g., `http://localhost:5173/{uuid}`).
1. Enter your name as the patient, initiate the call, and grant video/audio permissions.
1. Accept the call from your provider tab.

You should now be in a video call with yourself.

## Scripts

```sh
pnpm <script name>
```

If a script is environment specific, use:

```sh
pnpm <script name>:<env>
```

### `build`

Builds all packages using the [build script](./scripts/build.sh).

### `lint`

Lints all packages using [ESLint](https://eslint.org/).

### `start`

Environment specific: `local`, `dev`, `dev2`, `testing`, `staging`.

Starts all packages. If the env is excluded, [defaults to local](#getting-started).

### `update`

Interactively updates all dependencies to their latest versions, respecting ranges specified in `package.json`.
