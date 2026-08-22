# Medical record export

"Download Archive" on the patient record collects every document in a patient's chart into a single zip,
files it in the chart, and hands the user a download link.

## Asynchronous build

Collecting a large chart is thousands of presign + transfer round trips, which is far too slow for the
27 s API Gateway limit that applies to every `http_auth` zambda regardless of the timeout configured on
it. So the export runs as a background Task — the same pattern as ad-hoc reports and fax packets:

1. `get-patient-medical-record` (http_auth) creates an `export-medical-record` **Task**
   (`status: requested`, `Task.for` = the patient) and returns `{ taskId }` immediately. If an export is
   already queued or running for that patient it re-attaches to it instead of building a second archive,
   so a double-click or a page reload is harmless.
2. A FHIR subscription on `Task?code=…|export-medical-record&status=requested` (trigger: `create` only)
   fires `sub-export-medical-record` (subscription zambda, 900 s), which builds and uploads the archive,
   publishes progress onto `Task.output` as it goes, and records the finished object's Z3 url there.
3. The same `get-patient-medical-record` zambda, called with `{ taskId, patientId }`, reports status and
   progress and presigns the download url once the Task completes. The patient is part of the request and
   is checked against `Task.for` (along with the Task's code), because a Task id is not a capability — one
   guessed or borrowed id would otherwise presign someone else's record.

The Subscription deliberately triggers on `create` only. There is no continuation (see below), so a
create-only trigger makes it structurally impossible for a progress write to re-fire the worker.

### Who does the polling

`MedicalRecordExportWatcher` is mounted in `App.tsx` **outside `<Routes>`**, and that placement is the
whole design. The archive keeps building after the user leaves the patient page, so a watcher living on
that page unmounts, its query is dropped, and polling stops — the export then finishes unobserved and is
only noticed if someone happens to navigate back, which announces it long after the fact and starts a
download nobody just asked for. From outside the router the watcher survives navigation, so completion is
reported within one poll interval wherever the user is. It also sets `refetchIntervalInBackground`, since
a job the user was told to walk away from spends most of its life in an unfocused tab.

State lives in `medicalRecordExport.store.ts` (zustand, keyed by patient) so the patient page's button and
the app-wide watcher read the same job. `useDownloadMedicalRecord` is only a kickoff + "is one running".

Progress is a persistent snackbar registered as a notistack **variant**
(`Components={{ medicalRecordExport: … }}` on the provider), rendering notistack's own
`MaterialDesignContent` as `info` so it matches every other snackbar in the EHR — only the message body
differs. Two details are deliberate:

- The message body (`ExportProgressMessage`) is a separate component subscribed to the store, because
  notistack has no update-in-place API and re-enqueueing on every tick would flash the snackbar dozens of
  times during a large export.
- The variant override is declared **propless** (`medicalRecordExport: true`) and the job is found from the
  snackbar's own key via `taskIdFromExportSnackbarKey`. notistack's `VariantOverrides` are global, so
  declaring a required extra prop there makes `enqueueSnackbar` demand it at every call site whose
  `variant` is a computed union, `usePrintLabel` among them.

There is no separate "preparing…" snackbar at kickoff: the progress snackbar already says that and then
goes on to say something useful, so the two side by side were just noise. Progress is also deliberately
**not** in the Medical Record dropdown — that menu closes on click, so anything rendered there is invisible
for the entire run.

A full page reload is the one thing the watcher cannot survive. The Task id is parked in `sessionStorage`
and re-adopted on mount, but such a job is marked `resumed` and its archive is *offered* behind a Download
action rather than fetched — an unprompted download an unknown time later is startling, and the user may no
longer want it.

### Jobs nobody is working on

Nothing outside the worker ever moves a Task off an active status, so both "queued but never delivered"
and "started, then the invocation was killed" have to be recognised, or the chart becomes permanently
un-exportable. `isAbandonedExportTask` covers them differently:

- `requested` is judged on how long the Task has sat un-updated (`STUCK_REQUESTED_THRESHOLD_MS`, 5 min).
  Deliberately generous: subscription delivery has no SLA we control, and mistaking a slow delivery for a
  dead one has a second tab archive the whole chart again, while waiting too long only delays a retry.
- `in-progress` is judged against a **deadline the worker publishes on `Task.output` when it starts**,
  rather than against a quiet stretch — collection and the size pass can run for minutes without a single
  progress write. A Task that reached `in-progress` and never published one falls back to a 16-minute
  idle bound, past the zambda's own 900 s ceiling.

A kickoff that finds abandoned Tasks cancels them before queueing a replacement, so they stop matching the
active search and any front end still polling one sees a terminal state instead of waiting out its timeout.

### Incomplete archives are reported as such

An attachment whose bytes cannot be read is dropped during the size pass (below), so an export can finish
successfully while being incomplete. The skipped count rides along on `Task.output` progress and out
through the poll response, and the EHR reports it — a partial archive downloads with a warning naming how
many documents were left out, and a chart whose documents were *all* unreadable says so rather than
claiming there was nothing to download.

### What happens when something fails

A document that cannot be read has two quite different outcomes, and which one you get depends entirely on
*when* it fails:

| Failure | Outcome |
|---|---|
| Unreadable during the **size pass** (presign or probe fails) | Dropped. The export finishes, `skipped` is carried on the Task, and the user gets the archive with a warning naming how many documents were left out. All unreadable → reported as such, not as "no documents". |
| Fails to **open** during the write pass | Retried up to `DOWNLOAD_ATTEMPTS` with a fresh signature each time. Only then does the export fail. |
| Dies **mid-transfer** during the write pass | The whole export fails. Nothing partial is uploaded. |
| Upload refused (non-2xx) | Whole export fails, with the object store's status in the message. |
| Worker killed, or over its 13-minute budget | Task fails, or is later recognised as abandoned via its published deadline. |
| `createFilesDocumentReferences` throws after a successful upload | Task fails and no url reaches the Task, so the user sees a failure and no download. The uploaded object is orphaned in the bucket. |

The mid-transfer case is the price of streaming: the archive's length is committed in the upload headers
before any payload moves, so bytes already written cannot be taken back. That is also exactly why the retry
is confined to *opening* the stream — see the comment on `openAttachmentStream`. Failures are pushed into
the size pass wherever possible, because that is the one phase where a bad document can still be skipped.

Whatever fails, the worker never leaves a half-written archive presented as a good one: the Task ends
`failed`, and no download url is published.

**What the user is told follows outbound-fax.** The raw cause stays in the logs and on
`Task.statusReason`; it is never returned to the UI. The only text that crosses that boundary is a message
the worker deliberately wrote for the user, thrown as a `MedicalRecordExportUserError` and recorded under
`MEDICAL_RECORD_EXPORT_FAILURE_CODE` in `Task.output` — currently the archive being over the single-file
limit, and running out of time before the upload could start. Everything else reaches the front end with no
message and is reported as *"The medical record could not be processed. Please try again."*, the counterpart
to fax's *"The fax could not be processed."*

The kickoff request is the exception, and it matches fax too: that is a direct request/response, so its
error message is shown (`useSendFaxPacket` does the same). The convention is about the *background job's*
cause, which the user cannot act on and should not see.

## Streaming the archive

The archive is streamed straight into the presigned PUT rather than assembled in memory. Resident memory
is roughly `maxConcurrentDownloads × entryBufferBytes` (8 × 4 MiB by default) whether the archive is 5 MB
or 5 GB, which is why the zambda needs no raised `memorySize`.

Getting there takes two passes, in `packages/zambdas/src/shared/medical-record-export/`:

- **`sizes.ts`** resolves every attachment's exact byte length first, with a one-byte ranged GET
  (`Range: bytes=0-0`, read back off `Content-Range`). A ranged GET rather than a HEAD because the url is
  presigned for GET and SigV4 signs the method. FHIR's `attachment.size` is treated as a hint only — the
  object store is authoritative, since its length is what the archive's `Content-Length` must match.
  An attachment whose length cannot be resolved is dropped here; this is the **only** place dropping is
  still possible.
- **`zip-stream.ts`** stores entries uncompressed with known sizes, which lets yazl compute the archive's
  exact length before producing a byte. That length goes out as `Content-Length` and the archive is piped
  into the request. Entries are pulled in order with a sliding window of open downloads, each
  backpressured by its sink's high-water mark.

Because the length is committed in the request headers before any payload moves, an entry that fails
*mid-transfer* cannot be skipped the way a buffered build could skip it — it fails the whole export and
the user retries. That is the trade for unbounded archive size at flat memory.

Failures on either end of the pipe tear the other end down: the upload promise is wired into the same
abort path as the entry downloads, so a refused PUT stops the pump instead of leaving workers filling
sinks nobody is draining. And the worker's time budget is enforced by a **timer**, not between completed
entries — the failure worth bounding is a transfer that stalls, which completes nothing, so a per-entry
check would never run and the invocation would burn to its 900 s ceiling.

Charts are overwhelmingly PDFs and JPEGs, which are already compressed, so storing uncompressed costs a
couple of percent of size and buys the predictable length.

### Two things worth knowing before changing `zip-stream.ts`

**`forceZip64Format: true` on `end()` is load-bearing, not a preference.** yazl decides whether to emit
the 76-byte ZIP64 end-of-central-directory record in two places that disagree: its size predictor tests
`centralDirectorySize >= 0xffff`, while its writer tests `sizeOfCentralDirectory >= 0xffffffff` — the
correct bound, since the field is four bytes wide. For any archive whose central directory exceeds 64 KiB
(around 900 entries; the chart that prompted this work had 1082 documents) yazl predicts 76 bytes more
than it writes, so the upload can never satisfy its own `Content-Length` and hangs until the far end times
out. Forcing the record puts both branches on the same path at every size.

**5 GiB is a hard ceiling.** Z3 exposes only a single-shot presigned PUT — no multipart upload — and S3
refuses a single PUT over 5 GiB. An export past that fails with a clear message. If charts ever routinely
exceed it, the way out is **multi-volume output**: one complete archive per invocation, `Task.output`
accumulating N urls. That is also the only way "successive invocations of the handler" could work, since a
single streamed object cannot span invocations.

## Storage and reuse

The archive goes to the `medical-record-exports` bucket and is filed as a `medical-record-export`
DocumentReference in the patient's "Medical Records" folder. `collectPatientRecordAttachments` excludes
both `medical-record-export` and `fax-packet` documents, so an export is never bundled into a later one and
a sent packet's cover sheet (which names a recipient) never leaks into a downloaded record.

Those collection helpers in `packages/zambdas/src/shared/patient-documents.ts` are shared with the
outbound-fax packet builder — changing them affects both.

## Who can export

Any EHR staff role — Administrator, Manager, Staff, Provider, Clinician, Customer Support — can export any
patient. All six hold `Zambda:Function:*` in `config/oystehr-core/roles.json`, and
`get-patient-medical-record` performs no role check of its own. On the patient page the action is gated
only by `!isMergedPatient`.

Worth stating plainly, because it is not obvious from the code: the archive is assembled with the **M2M
token**, not the caller's. The caller's own FHIR access policy therefore does not bound what an export
returns — whoever can invoke the zambda can name any `patientId` and receive that chart's complete
document set.

This is a deliberate decision, not an oversight. These roles can already open every one of those documents
individually in the Docs UI, so the export is a convenience over access they hold anyway rather than a new
grant of it. If that calculus ever changes, `requireUserWithRole` from `shared/auth` is the hook — nine
other EHR zambdas already use it — and the button would need the same gate so the UI does not offer an
action the backend refuses.

## Local development

Nothing fires FHIR subscriptions locally, so the worker has to be invoked by hand. With the local server
running (`npm run zambdas:start`):

```bash
npx tsx scripts/tests/test-medical-record-export.ts <patientId> [--download]
```

That drives the whole sequence — kick off, invoke `sub-export-medical-record` with the Task as its raw
body the way the platform would, then poll to completion — and with `--download` writes the archive to
`/tmp` so it can be checked with `unzip -t`.
