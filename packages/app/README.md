# App

The static front end web application for Ottehr.

## Run Locally

The front end is run locally using [Vite](https://vitejs.dev/).

Start it with:

```[bash]
pnpm start
```

## Deployment

To deploy, refer to the [Root README.md](../../README.md).

## Scripts

```sh
pnpm <script name>
```

If a script is environment specific, use:

```sh
pnpm <script name>:<env>
```

### `build`

Environment specific: `dev`, `testing`, `staging`, `production`.

Builds the front end.

### `lint`

Lints the front end using [ESLint](https://eslint.org/).

### `prettier`

Lints the front end using [Prettier](https://prettier.io/).

### `start`

Environment specific: `local`, `dev`, `testing`, `staging`.

Starts the front end that points to the local backend (`local`, make sure it's running) or the respective ZapEHR project (`dev`, `testing`, `staging`). If the env is excluded, [defaults to local](#run-locally).
