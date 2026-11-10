# PACS Poll Package

This package bundles a long-running service for a PACS gateway server. Every poll cycle it:

1. Polls Oystehr projects for ServiceRequest resources that indicate they need to be sent to teleradiology.
2. Makes a call to a local Mirth server to send the studies.
3. Patches ServiceRequest resources to indicate that they have been sent to teleradiology.
4. Optionally checks network reachability of the systems the gateway depends on (TCP connect from this host, DICOM C-ECHO from Mirth).

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
  "timeoutMs": 10000,
  "mirthEchoUrl": "http://localhost:8990/",
  "targets": [
    {
      "name": "lifesys-pacs",
      "host": "172.30.3.149",
      "port": 6696,
      "dicomEcho": { "calledAeTitle": "LIFESYS_AE", "callingAeTitle": "BRIDGELINK" }
    },
    { "name": "lifesys-gateway", "host": "172.30.3.1", "port": 22 },
    { "name": "bridgelink-http", "host": "127.0.0.1", "port": 8989 }
  ]
}
```

- Every target gets a plain TCP connect check from the pacs-poll host: can the host and port be reached at all (tunnel up, route present, firewall open)? bridgelink runs with host networking, so this exercises the same route Mirth uses.
- Targets with a `dicomEcho` block also get a DICOM C-ECHO (Verification SOP Class), performed by Mirth. pacs-poll POSTs the target to `mirthEchoUrl` and treats a 2xx answer as a successful echo, so the check exercises the actual sender, with its AE title and DICOM stack. `callingAeTitle` is optional; when omitted the Mirth channel uses its own default. AE titles are 1-16 printable ASCII characters.
- `mirthEchoUrl` is required as soon as any target has a `dicomEcho` block.
- `name` must be unique and becomes the `target` metric label. `timeoutMs` (default 10000) bounds each individual check. Leave headroom for Mirth to start a dcm4che process and complete the DICOM round trip.
- All targets are checked concurrently at the start of each poll cycle. A failed check never fails the cycle; it is logged and recorded in the metrics.
- The file is read once at startup, so restart the service after editing it. A malformed file stops the service from starting with a message naming the problem. Without the file the checks are skipped.

#### The Mirth echo channel

pacs-poll expects a Mirth channel with an HTTP Listener at `mirthEchoUrl` that performs a C-ECHO and reports the result through the HTTP status:

```
POST <mirthEchoUrl>
Content-Type: application/json

{ "target": "lifesys-pacs", "host": "172.30.3.149", "port": 6696, "calledAeTitle": "LIFESYS_AE", "callingAeTitle": "BRIDGELINK" }
```

| Response                     | Meaning                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| any 2xx                      | The echo succeeded                                                      |
| anything else                | The echo failed; the body is logged by pacs-poll (first 300 characters) |
| no answer within `timeoutMs` | Recorded as `timeout`                                                   |
| connection refused           | Recorded as `mirth_unreachable`                                         |

bridgelink has dcm4che mounted at `/opt/dcm4che`, and `storescu` sends only a C-ECHO when given no files, so a JavaScript step along these lines does the job (adjust TLS options to match how the real sends are configured):

```javascript
var body = JSON.parse(connectorMessage.getRawData());
var command = ['/opt/dcm4che/bin/storescu', '-c', body.calledAeTitle + '@' + body.host + ':' + body.port];
if (body.callingAeTitle) {
  command.push('-b', body.callingAeTitle);
}
var process = java.lang.Runtime.getRuntime().exec(command);
var output =
  org.apache.commons.io.IOUtils.toString(process.getInputStream(), 'UTF-8') +
  org.apache.commons.io.IOUtils.toString(process.getErrorStream(), 'UTF-8');
var exitCode = process.waitFor();
responseStatus = exitCode === 0 ? 200 : 502; // map to the HTTP Listener's response status
channelMap.put('echoOutput', output);
```

#### Testing the echo mechanism on the gateway

`scripts/test-dicom-echo.sh` exercises the mechanism one layer at a time (TCP connect from the host, `storescu` inside the bridgelink container, the Mirth channel with a positive and a negative request, and the pacs-poll metrics), so a failure points at the layer that is broken. Copy it to the gateway and run it as a user that can talk to docker:

```bash
./test-dicom-echo.sh -c LIFESYS_AE -H 172.30.3.149 -p 6696 -b BRIDGELINK
```

`-h` lists the options, including the Mirth and metrics URLs and `-s` to skip layers. Anything after `--` is passed to `storescu`, for example TLS options.

## Metrics

| Metric                                                 | Type    | Labels                                          | Meaning                                                      |
| ------------------------------------------------------ | ------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `pacs_poll_last_run_timestamp_seconds`                 | gauge   |                                                 | Unix time of the last completed poll cycle                   |
| `pacs_poll_run_duration_seconds`                       | gauge   | `project_id`                                    | Duration of the last cycle per project                       |
| `pacs_poll_service_requests_found`                     | gauge   | `project_id`                                    | ServiceRequests found needing a teleradiology send           |
| `pacs_poll_service_requests_sent`                      | gauge   | `project_id`                                    | ServiceRequests successfully sent via Mirth                  |
| `pacs_poll_mirth_errors_total`                         | counter | `project_id`                                    | Mirth send failures                                          |
| `pacs_poll_patch_errors_total`                         | counter | `project_id`                                    | FHIR patch failures                                          |
| `pacs_poll_auth_errors_total`                          | counter | `project_id`                                    | OAuth token fetch failures                                   |
| `pacs_poll_cycle_errors_total`                         | counter | `project_id`                                    | Poll cycle errors per project                                |
| `pacs_poll_tcp_connect_success`                        | gauge   | `target`, `host`, `port`                        | 1 if the last TCP connect succeeded, 0 if it failed          |
| `pacs_poll_tcp_connect_duration_seconds`               | gauge   | `target`, `host`, `port`                        | Duration of the last TCP connect attempt                     |
| `pacs_poll_tcp_connect_last_success_timestamp_seconds` | gauge   | `target`, `host`, `port`                        | Unix time of the last successful TCP connect                 |
| `pacs_poll_tcp_connect_failures_total`                 | counter | `target`, `host`, `port`, `reason`              | Failed TCP connects by reason (see below)                    |
| `pacs_poll_dicom_echo_success`                         | gauge   | `target`, `host`, `port`, `called_ae`           | 1 if the last C-ECHO sent by Mirth succeeded, 0 if it failed |
| `pacs_poll_dicom_echo_duration_seconds`                | gauge   | `target`, `host`, `port`, `called_ae`           | Duration of the last C-ECHO round trip through Mirth         |
| `pacs_poll_dicom_echo_last_success_timestamp_seconds`  | gauge   | `target`, `host`, `port`, `called_ae`           | Unix time of the last successful C-ECHO                      |
| `pacs_poll_dicom_echo_failures_total`                  | counter | `target`, `host`, `port`, `called_ae`, `reason` | Failed C-ECHOs by reason (see below)                         |

TCP failure reasons: `timeout`, `refused`, `unreachable`, `dns_error`, `reset`, `error`.

DICOM echo failure reasons: `echo_failed` (Mirth answered with a non-2xx status, meaning the echo itself failed), `timeout` (Mirth did not answer in time), `mirth_unreachable` (the Mirth listener could not be reached at all), `error`. The log line for a failed check carries Mirth's response body, such as the dcm4che output.

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
