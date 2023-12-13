# Ottehr

The production-ready, open-source EHR.

This monorepo contains code for the entire Ottehr telehealth platform.

Ottehr is modern, modular EHR started as a reference implementation for [ZapEHR](https://zapehr.com).  It quickly outgrew "sample EHR" status and became the foundation for large-scale production EHR installations.  Ottehr uses ZapEHR for back-end service endpoints, and requires a free ZapEHR account to run as-is, but you are welcome to modify and use a third-party service vendor or build your own service architecture.  Ottehr is designed for developers, hopefully making it easy to fork, white-label, and build entire new classes of EHRs and health-tech products with a fraction of the effort of starting from scratch.   

## First Time Setup

For a video walkthrough, please see this [getting started with ottehr video](https://youtu.be/NJzF9Nzhbeo).

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

#### Manual Installation:

Alternatively, you can install `pnpm` using the [official documentation](https://pnpm.io/installation).

### Joining zapEHR

You'll need a free zapEHR account to run Ottehr.  Register for access at [zapehr.com](https://zapehr.com). Follow these simple steps:

1. Visit [zapehr.com](https://zapehr.com).
2. Click on **Free Access** to initiate your early access request.

Once your request is received, the zapEHR team will promptly reach out to you via email, providing the credentials you need to kickstart your zapEHR journey.

For comprehensive guidance on getting started with zapEHR, explore our technical documentation available at [https://docs.zapehr.com/docs/welcome](https://docs.zapehr.com/docs/welcome).

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

Once these dependencies are in place, execute the setup script from the root directory:

```bash
sh scripts/setup.sh
```

The script will prompt you for the following information:

- Your access token: Log in to your [ZapEHR project](https://console.zapehr.com), and copy the access token from the dashboard.
- Your project ID: Find this on the [ZapEHR project details page](https://console.zapehr.com/project).
- Your first provider email: This can be your email address.

Upon completion, the script will generate important links highlighted in magenta. Follow these steps:

1. Locate the reset password link in the console output and visit the provided URL in your browser to set a password.
2. Go to `http://localhost:5173/dashboard` and log in using the email provided to the script and the chosen password.
3. Open a new tab and visit the waiting room URL, as output in the script logs (e.g., `http://localhost:5173/{uuid}`).
4. Enter your name as the patient, initiate the call, and grant video/audio permissions.
5. Accept the call from your provider tab.

You should now be in a video call with yourself.

## Repository Structure

This repository uses a monorepo structure. Each package has its own code in its respective folder in [`packages/`](./packages/).

- `app` - The static frontend website that patients use to join their telehealth visit and providers use to answer.
- `zambdas` - The application's backend endpoints, deployed on the zapEHR platform.

Each package has its own README explaining in more detail its purpose, as well as how to run locally and deploy (if applicable).

Run `pnpm i` at the root level to install dependencies for all packages in the monorepo. Then run `pnpm start` to start all packages locally.

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
