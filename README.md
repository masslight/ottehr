# Ottehr

## Repository Structure

This repository uses a monorepo structure. Each node module has its own code in its repsective folder in `packages/`.

- `app` - The static frontend website that patients use to join their telehealth visit and providers use to answer.
- `zambdas` - The application's backend endpoints, deployed on the zapEHR platform.

Each package has its own README explaining in more detail its purpose, as well as how to run locally and deploy (if applicable).

## First Time Setup

### Node

- Install [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).
- Use nvm to install node 18: `nvm install 18`.
- Use nvm to make node 18 your default node: `nvm alias default 18`.

### ESLint

To keep our code easily readable, there is a rigorous eslint configuration enforced. VSCode is recommended for coding because it provides an excellent live linting experience.

To get linting in VSCode:

1. Install the ESLint Extension.
2. Always open the repo from its root. This allows the extension to detect the `.eslintrc.json` file which specifies the linter configuration.

### pnpm

The easiest way to get started with pnpm is to use the brew command:

```bash
brew install pnpm
```

Otherwise, you can install `pnpm` onto your machine using the [pnpm documentation](https://pnpm.io/installation).

### pnpm install

run `pnpm install` at the top level to install dependencies for all packages in the monorepo.

### Start up the frontend or backend

Navigate to the directory for the app you want to run, and check out the frontend (`app`) and backend (`zambdas`) to learn how to run them locally.

## VSCode Workspace (Optional)

There is a vscode workspace defined in the root's `.vscode` folder. The workspace provides a helpful alternative organization of the project in the VSCode 'Explorer' which most developers find useful.

The workspace can be opened with the VSCode CLI:

```[bash]
code .vscode/Ottehr.code-workspace
```

or alternatively by opening `.vscode/Ottehr.code-workspace` from VSCode.
