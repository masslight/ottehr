# PACS Poll Package

This package bundles a long-running service for a PACS gateway server. Every poll cycle it:

1. Polls Oystehr projects for ServiceRequest resources that indicate they need to be sent to teleradiology.
2. Makes a call to a local Mirth server to send the studies.
3. Patches ServiceRequest resources to indicate that they have been sent to teleradiology.
4. Optionally checks network reachability of the systems the gateway depends on (TCP connect and DICOM C-ECHO).

It exposes Prometheus metrics on `GET /metrics` and a liveness probe on `GET /health`.

## Setup

The package depends on having one or more files in the .env directory. Make one file per project needing to be polled with the format:

```json
{
  "projectId": "some-oystehr-project-uuid",
  "clientId": "abcdefg",
  "clientSecret": "123456",
  "advapacsTenant": "tenant-name"
}
```

Name the files <something>.env.json.

### Environment variables

| Variable           | Default | Meaning                                             |
| ------------------ | ------- | --------------------------------------------------- |
| `POLL_INTERVAL_MS` | `60000` | Time between poll cycles                            |
| `METRICS_PORT`     | `9090`  | Port the `/metrics` and `/health` HTTP server binds |

### Connectivity checks (optional)

To have each poll cycle verify that the gateway can reach the systems it depends on, add `.env/connectivity.json`:

```json
{
  "timeoutMs": 5000,
  "targets": [
    {
      "name": "lifesys-pacs",
      "host": "172.30.3.149",
      "port": 6696,
      "dicomEcho": { "calledAeTitle": "LIFESYS_AE", "callingAeTitle": "PACS_POLL" }
    },
    {
      "name": "advapacs-gateway-urgikids",
      "host": "127.0.0.1",
      "port": 6670,
      "dicomEcho": { "calledAeTitle": "URGIKIDS" }
    },
    { "name": "bridgelink-http", "host": "127.0.0.1", "port": 8989 }
  ]
}
```

- Every target gets a plain TCP connect check: can the host and port be reached at all (tunnel up, route present, firewall open)?
- Targets with a `dicomEcho` block also get a DICOM C-ECHO (Verification SOP Class) on a separate connection: does the thing listening there speak DICOM and accept an association for `calledAeTitle`? `callingAeTitle` defaults to `PACS_POLL`. AE titles are 1-16 printable ASCII characters. The C-ECHO is implemented natively, so neither dcm4che nor Java is needed on the host.
- `name` must be unique and becomes the `target` metric label. `timeoutMs` (default 5000) bounds each individual check, connect included.
- All targets are checked concurrently at the start of each poll cycle. A failed check never fails the cycle; it is logged and recorded in the metrics.
- The file is read once at startup, so restart the service after editing it. A malformed file stops the service from starting with a message naming the problem. Without the file the checks are skipped.

## Metrics

| Metric                                                 | Type    | Labels                                          | Meaning                                                             |
| ------------------------------------------------------ | ------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| `pacs_poll_last_run_timestamp_seconds`                 | gauge   |                                                 | Unix time of the last completed poll cycle                          |
| `pacs_poll_run_duration_seconds`                       | gauge   | `project_id`                                    | Duration of the last cycle per project                              |
| `pacs_poll_service_requests_found`                     | gauge   | `project_id`                                    | ServiceRequests found needing a teleradiology send                  |
| `pacs_poll_service_requests_sent`                      | gauge   | `project_id`                                    | ServiceRequests successfully sent via Mirth                         |
| `pacs_poll_mirth_errors_total`                         | counter | `project_id`                                    | Mirth send failures                                                 |
| `pacs_poll_patch_errors_total`                         | counter | `project_id`                                    | FHIR patch failures                                                 |
| `pacs_poll_auth_errors_total`                          | counter | `project_id`                                    | OAuth token fetch failures                                          |
| `pacs_poll_cycle_errors_total`                         | counter | `project_id`                                    | Poll cycle errors per project                                       |
| `pacs_poll_tcp_connect_success`                        | gauge   | `target`, `host`, `port`                        | 1 if the last TCP connect succeeded, 0 if it failed                 |
| `pacs_poll_tcp_connect_duration_seconds`               | gauge   | `target`, `host`, `port`                        | Duration of the last TCP connect attempt                            |
| `pacs_poll_tcp_connect_last_success_timestamp_seconds` | gauge   | `target`, `host`, `port`                        | Unix time of the last successful TCP connect                        |
| `pacs_poll_tcp_connect_failures_total`                 | counter | `target`, `host`, `port`, `reason`              | Failed TCP connects by reason (see below)                           |
| `pacs_poll_dicom_echo_success`                         | gauge   | `target`, `host`, `port`, `called_ae`           | 1 if the last C-ECHO succeeded, 0 if it failed                      |
| `pacs_poll_dicom_echo_duration_seconds`                | gauge   | `target`, `host`, `port`, `called_ae`           | Duration of the last C-ECHO, association setup and release included |
| `pacs_poll_dicom_echo_last_success_timestamp_seconds`  | gauge   | `target`, `host`, `port`, `called_ae`           | Unix time of the last successful C-ECHO                             |
| `pacs_poll_dicom_echo_failures_total`                  | counter | `target`, `host`, `port`, `called_ae`, `reason` | Failed C-ECHOs by reason (see below)                                |

TCP failure reasons: `timeout`, `refused`, `unreachable`, `dns_error`, `reset`, `error`.

DICOM echo failure reasons: `connect_error`, `timeout`, `association_rejected` (for example the called AE title is not recognized), `presentation_context_rejected` (the peer does not offer Verification), `aborted`, `connection_closed`, `protocol_error`, `echo_failure_status` (the peer answered with a non-zero DIMSE status). The log line for a failed check carries the decoded detail, such as the A-ASSOCIATE-RJ reason or the DIMSE status code.

Example alert expressions:

```promql
# Host or tunnel down
pacs_poll_tcp_connect_success == 0

# Reachable but DICOM has not answered for 10 minutes
time() - pacs_poll_dicom_echo_last_success_timestamp_seconds > 600
```

## Build + Lint + Test

`npm run build`
`npm run lint`
`npm test`

## Bundle + Deploy

`npm run bundle` &mdash; Bundles code to index.js

Copy the .dist folder (which includes the .env directory) to the server and run it as a long-lived service, for example under systemd. It polls every `POLL_INTERVAL_MS` and serves metrics on `METRICS_PORT`.
