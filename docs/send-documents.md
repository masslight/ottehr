# Sending Documents

Sending patient documents to an outside recipient, typically the patient's primary care physician, by fax or as an
emailed link. Both channels send the same document packet; only the last step, delivery, differs per recipient.

## Entry points

- Encounter header → kebab menu (⋮) → **Send Documents**: one visit's package. Available on in-person, telemed and
  follow-up visits (they all render `features/visits/in-person/components/Header.tsx`). There is no signed-note
  gating: documents can be sent at any point in the visit.
- Patient record → **Send Patient Docs**: several visits, each with its own cover sheet.
- Patient record → Medical Record menu → **Send by Fax or Email**: every document on file in a date range.
- Patient Docs table → a row's send action: that one document.

Each entry point is one variant of `DocumentPacketSource`. The old "Send Fax" button on Review & Sign has been
removed. `SendFaxButton` still exists, but only the radiology order flow uses it.

## The document packet

Oystehr's fax service (`oystehr.fax.send`) accepts **one** PDF per call, so every send produces a single
merged PDF — the *document packet*. An email recipient gets the same PDF behind a link. The whole visit package is
always sent (there is no per-document selection); the dialog just shows an info tooltip listing what will go out.

```
[cover sheet] + [Visit/Progress Note] + [Discharge Summary] + [Lab Results] + [Radiology Results] + [Patient Education]
```

Merge order is fixed (`PACKET_DOCUMENT_ORDER`).

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

### Generating the note before it is signed

The canonical visit-note PDF is produced asynchronously after `sign-appointment`. When documents are sent earlier,
the note is rendered in memory via `createProgressNotePdfBytes` and merged into the packet only. It is never
uploaded as, nor allowed to supersede, the canonical `75498-6` DocumentReference.

The chart-data gathering is shared: `assembleProgressNoteInput` (`shared/pdf/`) builds the `ProgressNoteInput`
for both the visit-note subscription (which persists the note after signing) and the packet collector (which
regenerates it on the fly), so a sent note can never diverge from the one that will be stored.

### Cover sheet

`shared/pdf/packet-cover-sheet-pdf.ts`, rendered per recipient (the body is merged once and reused). Carries the
subject line (visit type, patient, PID, VID, DOS), recipient block (with the recipient's fax number or email),
sender block (organization, location address, practitioner, NPI), the HIPAA confidentiality statement from
`HIPAA_CONFIDENTIALITY_STATEMENT`, the page count and a timestamp.

Page count is resolved in two passes: the body is merged first, the cover rendered with
`totalPages = 1 + bodyPages`, and re-rendered if the cover itself spilled onto a second page.

### Storage

Each packet is uploaded to the `faxes` bucket with a unique filename and filed as a `fax-packet`
DocumentReference in the patient's "Faxes" folder (the bucket and type code predate email and stay as stored).
Packets are **immutable** — nothing is superseded — so a retry re-sends exactly the bytes that were originally
sent.

## Asynchronous send

Building and sending the packet is too slow for the 27 s API Gateway limit on `http_auth` zambdas, so it
runs as a background Task — the same pattern as merge-patients:

1. `send-document-packet` (http_auth) validates, resolves the patient, creates a `send-document-packet` **Task**
   (`status: requested`, recipients carried as JSON on `Task.input`) and returns `{ taskId }` immediately.
2. A FHIR subscription fires `sub-send-document-packet` (subscription zambda, up to 300 s / 3008 MB), which builds
   the packet once, delivers it to each recipient over that recipient's channel, saves the recipient as PCP if
   requested, and writes the per-recipient results onto the Task's `output`. The raw cause of any failure stays in
   the server logs and `Task.statusReason`; it is never returned to the UI.
3. The UI polls `get-document-packet-status` (2 s interval, stops on a terminal state). On completion it shows a
   success snackbar, or a persistent error snackbar naming the recipients that failed (name + fax number or
   email only, no cause). A hard job failure shows a generic error, or the size limit when the packet was too
   large (`failureReason: 'too-large'`).

## Delivery

`deliver-document-packet.ts` uploads each recipient's packet, then hands it to `sendPacketToRecipient`, the one
place that picks the channel. Both channels reuse the outbound-delivery machinery: one attempt `Task` per
recipient, recording the recipient's organization and phone, the packet page count and the list of documents that
went into it. Attempts show up in the patient's Action Logs and in the visit's activity log.

### Fax

`shared/send-fax-attempt.ts` sends the packet with `oystehr.fax.send` and records the `Communication` it returns.
Fax attempts are listed on the Fax Logs tab, with per-recipient retry.

### Email

Each recipient row has a Fax / Email toggle while `sendgridEnabled` is on. An email recipient gets the same packet,
cover sheet included, but as a link rather than an attachment: `shared/document-link-email.ts` emails a token signed
by `shared/document-link-token.ts` that expires after `DOCUMENT_LINK_TTL_MINUTES` (60). The token rides in the URL
fragment, and intake moves it into the history entry before Sentry or GTM start, so no server log or telemetry
records it. The link opens the intake page `OpenDocumentLink`, which calls the public `open-document-link` zambda:

- A live token returns a short-lived download URL and records a `link-opened` output on the attempt Task.
- An expired token re-sends a fresh link to the recipient recorded on the Task (never to an address from the
  request). The new attempt is `partOf` the one it replaces, and there is one live link per send: while any link
  in the chain is still live or still being sent, nothing is re-sent, and concurrent opens of one expired link
  claim a single successor, so only one new link goes out. A send stops re-sending at `MAX_RESEND_CHAIN_SIZE`
  (50) links, the most that opening and revoking walk, and its expired links then ask the recipient to contact the
  practice.
- Revoking a link from Action Logs (`revoke-action-log`) cancels every attempt in its resend chain, from the
  original send on, so no link of that send opens or re-sends again.

A failed link email is not retried from Action Logs; it is usually a bad address and is sent again from the
Send dialog.

## Limits and failure behaviour

- 100 pages / 20 MB per packet (`DOCUMENT_PACKET_MAX_PAGES`, `DOCUMENT_PACKET_MAX_BYTES`), checked before upload.
- Up to 5 recipients per send (`DOCUMENT_PACKET_MAX_RECIPIENTS`).
- One recipient failing does not abort the others; the status poll reports each one and the UI lists the
  failures (name + fax number or email, no raw cause) in a snackbar. A packet over the size limit is the
  exception: it fails the whole send before anything is uploaded.
- Saving a recipient as the patient's PCP never fails the send — a failure is logged and swallowed.

## Saving a recipient as the PCP

The patient record holds exactly one PCP (a contained `Practitioner` with the fixed id
`primary-care-physician`), so "Save as patient's PCP" behaves like a radio across recipients. It is pre-ticked
on the first recipient only when the patient has no PCP on file — an existing PCP is never overwritten
silently. Persistence goes through the same `getPCPPatchOps` path that `update-patient-account` uses. Only a
fax recipient can be saved: the PCP record holds a fax number but no email, so the checkbox is hidden on the
Email channel.

Each recipient has a name and, beside it, an optional credential ("MD", "DO", "NP"). The cover sheet, the delivery
attempt and the status report address the recipient as "Jane Doe, MD" when a credential is given, the name alone
otherwise. "Save as patient's PCP" uses the name only, so the credential never ends up in the PCP's last name.

The recipient's Organization field comes first and is the third party directory picker
(`features/address-book/AddressBookPicker`, no tag filter). It searches by organization and by person name.
Picking a contact fills each field with its own part: the organization, the person's name, the credential, fax
and phone. A contact with no person leaves the name empty; a contact with no organization leaves the
organization empty. Free text works as before.

## Code map

| Layer | Location |
|---|---|
| Packet contract | `packages/utils/lib/types/api/document-packet.types.ts` |
| Email link contract | `packages/utils/lib/types/api/document-link.types.ts` |
| Document collection & availability | `packages/zambdas/src/shared/document-packet/collect-visit-documents.ts`, `collect-patient-documents.ts` |
| Source resolution | `packages/zambdas/src/shared/document-packet/resolve-packet-source.ts` |
| Packet assembly | `packages/zambdas/src/shared/document-packet/build-document-packet.ts` |
| Cover sheet | `packages/zambdas/src/shared/pdf/packet-cover-sheet-pdf.ts` |
| PDF merge helpers | `packages/zambdas/src/shared/pdf/merge-pdfs.ts` |
| Delivery core (build body, per-channel send, cover, save PCP) | `packages/zambdas/src/shared/document-packet/deliver-document-packet.ts` |
| Fax delivery | `packages/zambdas/src/shared/send-fax-attempt.ts` |
| Email delivery | `packages/zambdas/src/shared/document-link-email.ts`, `packages/zambdas/src/shared/document-link-token.ts` |
| Zambdas | `packages/zambdas/src/ehr/{send-document-packet,get-document-packet-preview,get-document-packet-status}` |
| Email link zambdas and page | `packages/zambdas/src/patient/open-document-link`, `packages/zambdas/src/ehr/revoke-action-log`, `apps/intake/src/pages/OpenDocumentLink.tsx` |
| Subscription | `packages/zambdas/src/subscriptions/task/sub-send-document-packet` |
| EHR feature slice | `apps/ehr/src/features/send-documents` (public API: `SendDocumentsDialog`, `useSendDocuments`) |

The EHR slice keeps business rules in `model/` as pure functions, data access in `hooks/` and `api/`, and the
components thin. The form uses react-hook-form: `SendDocumentsForm` mounts only after the preview loads and seeds
`useForm` from it at mount (no syncing effect); `useSendDocuments` owns the dialog lifecycle, the queue mutation and
the status poll.
