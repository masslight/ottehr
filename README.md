# Ottehr

## First Time Setup

### Node

- Install [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).
- Use nvm to install node 18: `nvm install 18`.
- Use nvm to make node 18 your default node: `nvm alias default 18`.

Upon successful installation, verify the setup by executing the following command: `node -v`. If the installation was successful, this command should provide the version of Node currently installed

### Installing `pnpm`

The easiest way to get started is to use the [brew](https://brew.sh/) or [npm](https://www.npmjs.com/) command:

```bash
brew install pnpm
```
OR
```bash
npm install -g pnpm
```

Otherwise, you can install it onto your machine using the [documentation](https://pnpm.io/installation).

### Setup Script

The rest of this setup guide assumes that you have access to a ZapEHR project and have cloned down a fork of the ottehr repository. If you have not, please follow these steps:

1. Fork Ottehr: https://github.com/masslight/ottehr/fork
2. Copy your fork SSH clone link and `git clone git@github.com:{your_profile}/ottehr.git` in the folder you'd like to use
3. (optional) Add ottehr as upstream `git remote add upstream git@github.com:masslight/ottehr.git`
4. Open repo in editor of your choice, I will use vscode `code .vscode/Ottehr.code-workspace`

Before you continue, please ensure that you have [node](#node) v18.x and [pnpm](#installing-pnpm) installed on your machine.

After you have these dependencies installed, please execute the setup script from the root directory:

```bash
sh scripts/setup.sh
```

You will be asked for this information as input:

- Your access token. Login to your [ZapEHR project](https://console.zapehr.com) and copy the access token from the dashboard.
- Your project ID. You can find this on the [ZapEHR project details page](https://console.zapehr.com/project)
- Your first provider email. This can be your email.

This script will create various ZapEHR resources that are needed for you to begin development. After the script finishes running, there will be important links highlighted in magenta. You should follow these steps:

1. Find the reset password link in the console output and navigate to the url in your browser. Provide a password.
2. Navigate to `http://localhost:5173/dashboard` and login using the email you provided to the script and the password you chose.
3. Open a new tab and navigate to the waiting room URL. This was output in the script logs and is shown in the provider dashboard. It looks like `http://localhost:5173/{uuid}`
4. Enter your name to act as the patient and begin the call. Grant video/audio permissions.
5. Accept the call from your provider tab.

You should now be on a video call with yourself.


## Repository Structure

This repository uses a monorepo structure. Each package has its own code in its respective folder in [`packages/`](./packages/).

- `app` - The static frontend website that patients use to join their telehealth visit and providers use to answer.
- `zambdas` - The application's back end endpoints, deployed on the zapEHR platform.

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
