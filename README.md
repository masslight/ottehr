<p align="center">
   <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets-global.website-files.com/653fce065d76f84cf31488ae/6543bdda5daec299834a748e_otter%20logo%20white.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://assets-global.website-files.com/653fce065d76f84cf31488ae/65438838a5f9308ca9498887_otter%20logo%20dark.svg">
      <img alt="Ottehr Logo.">
   </picture>
</p>

<p align="center">The production-ready, open-source EHR</p>

<p align="center">
    <a target="_blank" href="https://www.ottehr.com/"><b>Ottehr.com</b></a>
</p>

<div align="center">

[![Latest Version](https://badgen.net/github/release/masslight/ottehr)](https://github.com/masslight/ottehr/releases)
[![Code Size](https://img.shields.io/github/languages/code-size/masslight/ottehr)](https://github.com/masslight/ottehr)
[![Contributors](https://badgen.net/github/contributors/masslight/ottehr)](https://github.com/masslight/ottehr/graphs/contributors)
[![GitHub Issues](https://badgen.net/github/open-issues/masslight/ottehr)](https://github.com/masslight/ottehr/issues)
[![GitHub Stars](https://badgen.net/github/stars/masslight/ottehr)](https://github.com/masslight/ottehr/stargazers)
[![GitHub Pull Requests](https://badgen.net/github/open-prs/masslight/ottehr)](https://github.com/masslight/ottehr/pulls)
[![GitHub Pull Requests Closed](https://badgen.net/github/merged-prs/masslight/ottehr)](https://github.com/masslight/ottehr/pulls)

</div>

# Ottehr

[Ottehr](https://www.ottehr.com/) is a modern, modular EHR. Ottehr uses the headless EHR [Oystehr](https://www.oystehr.com) as a service provider and to host its backend service endpoints. Ottehr requires a [free Oystehr account](https://docs.oystehr.com/oystehr/getting-started/quickstart/) to run as-is. Ottehr is designed for developers, making it easy to fork, white-label, and build entire new classes of EHRs and health-tech products with a fraction of the effort of starting from scratch.

Ottehr consists of three components:

- **[Ottehr Patient Portal](apps/intake)** &mdash; A patient-facing registration website for creating appointments and initiating telemedicine calls, with features including rescheduling, check-in, intake chatbot and paperwork, text messages and emails, and listing appointments for an account.
- **[Ottehr EHR](apps/ehr/)** &mdash; A staff-facing EHR for managing appointments and completing encounters, with features including checking appointments, managing patient queues, texting patients, updating a location's slots, setting a location's schedule, joining telemedicine calls, HPI and medical history, exam charting, eRx and assessment, patient plan, RCM and claims submission, and more.
- **[Ottehr Backend](packages/zambdas)** &mdash; The backend for the Patient Portal and EHR apps, it is composed of Function-as-a-Service endpoints deployed as [Oystehr Zambdas](https://docs.oystehr.com/oystehr/services/zambda/).

## Run Ottehr Locally

### AI-prompt setup

You can use an LLM to help you get up and running with Ottehr for the first time. First, [install Node.js 22](#install-nodejs-22x) and [Terraform 1.13](#install-terraform-113).

Clone the repository, start up Claude Code or similar at the root of the repository, and use a prompt like the one below and replacing the placeholders,

```md
I just cloned Ottehr, the open source EHR. I want to get up and running locally so I can kick the tires to check it out. In order to do this I know we'll need these three things: My PROJECT_ID is <PROJECT_ID>, and my M2M Client credentials are Client=<CLIENT_ID>, Secret=<SECRET_KEY>. Use the local terraform backend and add the main.tf file it's configured in to my personal .gitignore.
```

### Prerequisites

To run Ottehr, you'll need a free Oystehr account and Node.js.

#### Get Your Oystehr Account

1. Visit [oystehr.com](https://oystehr.com).
2. Click on **Free Access** to initiate your early access request.

Once your request is received, the Oystehr team will promptly create your account and reach out to you via email.

Check out the [Oystehr Technical Documentation](https://docs.oystehr.com/oystehr/getting-started/) to learn more about the Oystehr platform.

#### Install Node.js 22.x

If you do not already have it, [install Node.js](https://nodejs.org/en/download) v22.x.

Ottehr also supports `nvm`, `asdf`, and tools that use `.node-version`.

#### Install Terraform 1.13

If you do not already have it, install Terraform version 1.13. You can download this directly from HashiCorp's [releases page](https://releases.hashicorp.com/terraform) and install it into your path, or use [Homebrew](https://brew.sh). For example to install from HashiCorp on an ARM Mac:

```bash
brew install wget # or use cURL
wget https://releases.hashicorp.com/terraform/1.13.5/terraform_1.13.5_darwin_arm64.zip
unzip terraform_1.13.5_darwin_arm64.zip -d /tmp
sudo cp /tmp/terraform /usr/local/bin/terraform
```

Using Homebrew:

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

Check the [1.13 releases page](https://releases.hashicorp.com/terraform/1.13.5/) if you aren't sure which version to install.

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

### Configure Your Environment

Follow the instructions on setting up a new project in [`deploy/README.md`](/deploy/README.md#setting-up-a-new-project).

### Run the Application

```bash
npm run apps:start
```

### Log in and explore the Patient app

The Patient app starts up at <http://localhost:3002>

By default, the Patient app uses passwordless SMS for authentication. On the login screen, enter your mobile phone number followed by the one-time passcode which is sent to your device.

### Log in and explore the EHR

The EHR app starts up at <http://localhost:4002>

To log into the EHR, check the email address you provided during setup for an invitation to join the EHR application. Click the link, follow the account setup workflow, and then enter your credentials to complete login.

## End to End Test Setup Procedure

Ottehr includes a suite of end to end tests that can be used to maintain quality as you customize it for your use case. Learn more about how to configure and use the end to end tests in [E2E_README.md](./E2E_README.md).

## Repository Structure

This repository uses a monorepo structure.

- `apps` &mdash; Frontend web apps
  - intake &mdash; The patient's side
  - ehr &mdash; The provider's side
- `packages/zambdas` &mdash; The application's backend endpoints, deployed as [Oystehr Zambdas](https://docs.oystehr.com/oystehr/services/zambda/).
- `packages/{other folders}` &mdash; Other modules that are imported by apps like `utils`, `ui-components`

## Apps

### EHR App

- [Frontend Documentation](./apps/ehr/README.md)

### Patient Portal App

- [Frontend Documentation](./apps/intake/README.md)

### E2E Documentation

- [E2E Testing Guide](./E2E_README.md)

### Customization

#### To customize your Ottehr app

- Update the "VITE_APP_NAME" environment variable from both ehr and intake env folders
- Modify the project name, website and support email from `packages/utils/lib/types/constants.ts`

#### To theme your Ottehr Intake app

- Copy the files in `apps/intake/src/theme` into a new folder, for example `apps/intake/src/myTheme`
- Update the theme environment variables to point to your new folders:

  ```bash
  THEME_PATH='/src/themes/myTheme'
  ```

- Modify the images, SVGs and colors as needed
- Restart the app

#### To theme your Ottehr EHR app

- Copy the files in `apps/ehr/src/theme` into a new folder, for example `apps/ehr/src/myTheme`
- Update the theme environment variables to point to your new folders:

  ```bash
  THEME_PATH='/src/themes/myTheme'
  ```

- Modify the images, SVGs and colors as needed
- Restart the app

## Zambdas

- [Zambda Documentation](./packages/zambdas/README.md)
