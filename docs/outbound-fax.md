# Outbound Fax

Faxing the documents of a visit to an outside recipient, typically the patient's primary care physician.

## Entry point

Encounter header → kebab menu (⋮) → **Fax Documents**. Available on in-person, telemed and follow-up visits
(they all render `features/visits/in-person/components/Header.tsx`). There is no signed-note gating: a fax can
be sent at any point in the visit.

The old "Send Fax" button on Review & Sign has been removed. `SendFaxButton` still exists, but only the
radiology order flow uses it.

## The fax packet

Oystehr's fax service (`oystehr.fax.send`) accepts **one** PDF per call, so every send produces a single
merged PDF — the *fax packet*. The whole visit package is always sent (there is no per-document selection); the
dialog just shows an info tooltip listing what will go out.

```
[cover sheet] + [Visit/Progress Note] + [Discharge Summary] + [Lab Results] + [Radiology Results] + [Patient Education]
```

Merge order is fixed (`FAX_DOCUMENT_ORDER`).

| Document | Source | Included when |
|---|---|---|
| Visit/Progress Note | `DocumentReference` `75498-6`, or generated on the fly with `createProgressNotePdfBytes` when the visit is not signed yet | always |
| Discharge Summary | `DocumentReference` `discharge-summary` | one exists |
| Lab Results | `DocumentReference` LOINC `11502-2`, `docStatus === 'final'` | ≥ 1 reviewed result |
| Radiology Results | `searchRadiologyResultDocRefs` over the encounter's ServiceRequests | ≥ 1 result |
| Patient Education | `DocumentReference` `patient-education` | ≥ 1 document **and** no discharge summary in the packet |

**Prescriptions and Patient Instructions are sections of the visit note**, not standalone documents, so they
travel inside the Visit/Progress Note.

**Patient education / discharge summary:** `create-discharge-summary` physically merges the encounter's
patient education PDFs into the discharge summary PDF, and nothing in FHIR records that. Attaching both would
duplicate the pages, so `collect-visit-documents.ts` drops education whenever a discharge summary is included.
This rule lives there and nowhere else — the preview and the send both call into it.

## Generating the note before it is signed

The canonical visit-note PDF is produced asynchronously after `sign-appointment`. When a fax is sent earlier,
the note is rendered in memory via `createProgressNotePdfBytes` and merged into the packet only. It is never
uploaded as, nor allowed to supersede, the canonical `75498-6` DocumentReference.

The chart-data gathering is shared: `assembleProgressNoteInput` (`shared/pdf/`) builds the `ProgressNoteInput`
for both the visit-note subscription (which persists the note after signing) and the fax collector (which
regenerates it on the fly), so a faxed note can never diverge from the one that will be stored.

## Cover sheet

`shared/pdf/fax-cover-sheet-pdf.ts`, rendered per recipient (the body is merged once and reused). Carries the
subject line (visit type, patient, PID, VID, DOS), recipient block, sender block (organization, location
address, practitioner, NPI), the HIPAA confidentiality statement from
`HIPAA_FAX_CONFIDENTIALITY_STATEMENT`, the page count and a timestamp.

Page count is resolved in two passes: the body is merged first, the cover rendered with
`totalPages = 1 + bodyPages`, and re-rendered if the cover itself spilled onto a second page.

## Asynchronous send

Building and transmitting the packet is too slow for the 27 s API Gateway limit on `http_auth` zambdas, so it
runs as a background Task — the same pattern as merge-patients:

1. `send-fax-packet` (http_auth) validates, resolves the patient, creates a `send-fax-packet` **Task**
   (`status: requested`, recipients carried as JSON on `Task.input`) and returns `{ taskId }` immediately.
2. A FHIR subscription fires `sub-send-fax-packet` (subscription zambda, up to 300 s / 3008 MB), which builds
   the packet once, sends it to each recipient, saves the recipient as PCP if requested, and writes the
   per-recipient results onto the Task's `output`. The raw cause of any failure stays in the server logs and
   `Task.statusReason`; it is never returned to the UI.
3. The UI polls `get-fax-packet-status` (2 s interval, stops on a terminal state). On completion it shows a
   success snackbar, or a dialog naming the recipients that failed (name + number only, no cause). A hard job
   failure shows a generic error.

## Storage and audit

Each packet is uploaded to the `faxes` bucket with a unique filename and filed as a `fax-packet`
DocumentReference in the patient's "Faxes" folder. Packets are **immutable** — nothing is superseded — so a
retry from Fax Logs re-sends exactly the bytes that were originally transmitted.

Delivery reuses the existing outbound-delivery machinery: one attempt `Task` per recipient, `oystehr.fax.send`,
and the `Communication` it returns. Everything shows up in the patient's Action Logs (Fax Logs tab) and in the
visit's activity log, with per-recipient retry. The attempt Task records the recipient's organization and
phone, the packet page count and the list of documents that went into it.

## Limits and failure behaviour

- 100 pages / 20 MB per packet (`FAX_PACKET_MAX_PAGES`, `FAX_PACKET_MAX_BYTES`), checked before upload.
- Up to 5 recipients per send.
- One recipient failing does not abort the others; the status poll reports each one and the UI lists the
  failures (name + number, no raw cause) in a dialog.
- Saving a recipient as the patient's PCP never fails the send — a failure is logged and swallowed.

## Saving a recipient as the PCP

The patient record holds exactly one PCP (a contained `Practitioner` with the fixed id
`primary-care-physician`), so "Save as patient's PCP" behaves like a radio across recipients. It is pre-ticked
on the first recipient only when the patient has no PCP on file — an existing PCP is never overwritten
silently. Persistence goes through the same `getPCPPatchOps` path that `update-patient-account` uses.

## Code map

| Layer | Location |
|---|---|
| Contract | `packages/utils/lib/types/api/fax.types.ts` |
| Document collection & availability | `packages/zambdas/src/shared/fax/collect-visit-documents.ts` |
| Packet assembly | `packages/zambdas/src/shared/fax/build-fax-packet.ts` |
| Cover sheet | `packages/zambdas/src/shared/pdf/fax-cover-sheet-pdf.ts` |
| PDF merge helpers | `packages/zambdas/src/shared/pdf/merge-pdfs.ts` |
| Delivery core (build body, send, cover, save PCP) | `packages/zambdas/src/shared/fax/run-fax-packet.ts` |
| Zambdas | `packages/zambdas/src/ehr/{send-fax-packet,get-fax-packet-preview,get-fax-packet-status}` |
| Subscription | `packages/zambdas/src/subscriptions/task/sub-send-fax-packet` |
| EHR feature slice | `apps/ehr/src/features/fax` (public API: `SendFaxDialog`, `useSendFax`) |

The EHR slice keeps business rules in `model/` as pure functions, data access in `hooks/` and `api/`, and the
components thin. The form uses react-hook-form: `SendFaxForm` mounts only after the preview loads and seeds
`useForm` from it at mount (no syncing effect); `useSendFax` owns the dialog lifecycle, the queue mutation and
the status poll.
