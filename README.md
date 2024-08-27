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

## Setup

Ottehr currently has two websites. One is for patients -- **Ottehr Intake** -- and one is for staff -- **Ottehr EHR**.

* **[Ottehr Intake](packages/telemed-intake):** A patient-facing registration website for creating appointments, with features including rescheduling, checking in, text messages and emails, and listing appointments for an account
* **[Ottehr EHR](packages/telemed-ehr/):** A staff-facing EHR for managing appointments created, with features including checking appointments, managing patient queues, texting patients, updating a location's slots, setting a location's schedule, joining telemedicine calls, HPI and medical history, exam charting, eRx and Assessment, patient plan, coming soon: RCM and claims submission

## First Time Setup

To run Ottehr for the first time, you need to set up the project.


#### For Windows users:

We recommend using the Windows Subsystem for Linux (WSL) to run Ottehr on Windows. Follow these steps to set up WSL and install Node.js:

1.   Install **WSL** by following the official Microsoft guide: [Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

2. Open your **WSL** terminal and follow the instructions below to install nvm and Node.js.

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

```bash
npm install -g pnpm@9
```

### Joining Oystehr

You'll need a free Oystehr account to run Ottehr. Register for access at [oystehr.com](https://oystehr.com). Follow these simple steps:

1. Visit [oystehr.com](https://oystehr.com).
2. Click on **Free Access** to initiate your early access request.

Once your request is received, the Oystehr team will promptly reach out to you via email, providing the credentials you need to kickstart your Oystehr journey.

For comprehensive guidance on getting started with Oystehr, explore our technical documentation available at [https://docs.oystehr.com](https://docs.oystehr.com).

## Setup Procedure

To proceed with this setup guide, it is assumed that you have access to a Oystehr project. If you have done so, please follow these steps:

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

* Your access token: Log in to your Oystehr project on the [Oystehr Console](https://console.oystehr.com), and copy the access token from the dashboard
* Your project ID: Listed on the Oystehr Console next to the access token
* Your first provider email: This can be your email address

Once the program finishes running,

1. The Intake and EHR websites will open.
1. To log in to the EHR, enter the email you input during the setup program. Click `Forgot password?` and set a password then log in.

The URL for a test location is <http://localhost:3002/location/ak/in-person/prebook>.

## Scripts

```sh
pnpm <script name>
```

If a script is environment specific, use:

```sh
pnpm <script name>:<env>
```

### `telemed:start`

Starts Intake and EHR

### `build`

Builds all packages using the [build script](./scripts/build.sh).

### `lint`

Lints all packages using [ESLint](https://eslint.org/).

### `update`

Interactively updates all dependencies to their latest versions, respecting ranges specified in `package.json`.

## SendGrid Email Configuration

### Required Environment / Secrets
- SENDGRID_API_KEY
- TELEMED_SENDGRID_EMAIL_BCC
- TELEMED_SENDGRID_EMAIL_FROM
- TELEMED_SENDGRID_EMAIL_FROM_NAME
- TELEMED_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID
- TELEMED_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID
- TELEMED_SENDGRID_VIDEO_CHAT_INVITATION_EMAIL_TEMPLATE_ID

**Example Confirmation Template:**
```html
<!DOCTYPE html>
<html>
<head>
</head>
<body>
    <h2>You're confirmed!</h2>
    <p>Thanks for choosing Ottehr!</p><br>
    <p>Your check-in time for {{ firstName }} at {{ locationName }} is on {{ startTime }}.</p><br>
    <p>Please complete your paperwork in advance to save time at check-in. <a href="{{ paperworkUrl }}">Click here to complete paperwork</a></p><br>
    {{#notEquals appointmentType "walkin"}}
        <p><a href="{{ checkInUrl }}">Click here to modify/cancel your check-in</a></p><br>
    {{/notEquals}}
    <hr>
    <p>Thank you for choosing Ottehr. We look forward to partnering with you and your family.</p><br>
    <small>For questions or feedback, please <a target="_blank" href="https://www.ottehr.com/">Check out Ottehr</a></small>
</body>
</html>
```

**Example Cancellation Template:**
```html
<!DOCTYPE html>
<html>
<head>
</head>
<body>
    <h2>Sorry to have you go!</h2>
    <p>Your appointment for {{firstName}} at {{locationName}} on {{startTime}} has been cancelled.</p><br>
    <p><a href="{{ locationUrl }}">Click here to book again</a></p><br>
    <hr>
    <p>Thank you for choosing Ottehr. We look forward to partnering with you and your family.</p><br>
    <small>For questions or feedback, please <a target="_blank" href="https://www.ottehr.com/">Check out Ottehr</a></small>
</body>
</html>
```

**Example Invitation Template:**
```html
<!DOCTYPE html>
<html>
<head>
</head>
<body>
    <h2>You're Invited!</h2>
    <p>You have been invited to join an Ottehr visit with {{patientName}}.</p><br>
    <p><a href="{{ inviteUrl }}">Click here to join</a></p><br>
    <hr>
    <p>Thank you for choosing Ottehr. We look forward to partnering with you and your family.</p><br>
    <small>For questions or feedback, please <a target="_blank" href="https://www.ottehr.com/">Check out Ottehr</a></small>
</body>
</html>
```

## Theming & Localization
_At this time, dynamic theming and localization is only supported for the `telemed-intake` application._

### To theme your Ottehr `telemed-intake` app:
- Copy the files in `telemed-intake/app/src/assets/` into a new folder, for example `telemed-intake/app/src/assets/myTheme`
- Copy the files in `telemed-intake/app/src/lib/` into a new folder, for example `telemed-intake/app/src/lib/myTheme`
- Update the theme environment variables to point to your new folders:
    ```bash
    ASSETS_PATH='/src/assets/myTheme'
    THEME_PATH='/src/assets/myTheme/theme'
    TRANSLATIONS_PATH='/src/lib/myTheme'
    ```
- Modify the images, svgs, colors and translation files as needed
- Restart the app


## Contribute to Ottehr
We love it when you contribute to Ottehr! By submitting to this project, you agree to adopt the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) for your contributions.