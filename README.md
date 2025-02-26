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

This readme explains how to set up Ottehr locally. To learn more about using, customizing, and deploying Ottehr, check out the [Ottehr documentation](https://docs.oystehr.com/ottehr/welcome/).

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

Now that you have set up Ottehr, let's explore the project a bit to make sure everything is working properly.

Two applications should have been started automatically after setting up Ottehr.

* On localhost:3002 the patient application should be running

* On localhost:4002 the staff application should be running

The first thing we will do is create an appointment on the patient application, and check it on the staff application. These steps will check if that both the frontend and backend for the patient and staff applications are working as expected.

On the patient application, sign in by entering a phone number. Note that only numbers in the United States and Canada will work -- to configure authentication for numbers in other countries please contact us at support@oystehr.com.

Choose Schedule an In-Person Visit, then fill out patient information. You can complete the paperwork, it is optional.

Next, go to the staff application and select the In Person page. Select the location you made an appointment. The appointment you created should load. If it does, everything is working as expected. If it does not, check that you didn't miss any steps and if there is still a problem please open an issue.

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
