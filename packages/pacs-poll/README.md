# PACS Poll Package

This package bundles a script to run on a PACS gateway server. It:

1. Polls Oystehr projects for ServiceRequest resources that indicate they need to be sent to teleradiology.
2. Makes a call to a local Mirth server to send the studies.
3. Patches ServiceRequest resources to indicate that they have been sent to teleradiology.

## Setup

The package depends on having one or more files in the .env directory. Make one file per project needing to be polled with the format:

```json
{
  "projectId": "some-oystehr-project-uuid",
  "clientId": "abcdefg",
  "clientSecret": "123456"
}
```

Name the files <something>.env.json.

## Build + Lint

`npm run build`
`npm run lint`

## Bundle + Deploy

`npm run bundle` &mdash; Bundles code to index.js

The script is intended to be run from a cron job on a PACS gateway server. Copy the dist folder to the server and run it with an appropriate cron task.
