# Ottehr Visit Anatomy via Zambdas

Reference for synthesizing a complete, signed in-person visit in Ottehr by calling Ottehr's zambdas (and a few unavoidable FHIR/Z3 operations) through the Oystehr SDK. Audience: humans reading + scripts (or LLMs) generating synthetic data.

> **Scope.** In-person walk-in urgent-care visits. The output of a synthesis run is a Patient and a fully-completed, signed Encounter with one of every chart-data module element, plus the supporting/preceding resources you'd expect from a real visit produced through the EHR + intake apps.

The synthesizer drives the same backend code paths the EHR and intake apps use, so the resulting record is structurally identical to one a real provider would produce.

A central simplification: most of the visit narrative — Chief Complaint, HPI, Mechanism of Injury, ROS (structured), exam findings, Medical Decision-Making, Diagnoses, CPT, E&M, and patient instructions — comes from a **global template** applied with one zambda call. The script only writes patient-specific data (vitals, allergies, history, etc.) and orchestration around the template.

---

## Table of contents

1. [Setup and conventions](#1-setup-and-conventions)
2. [The visit lifecycle](#2-the-visit-lifecycle)
3. [Sign-off](#3-sign-off)
4. [Prerequisite lookups](#4-prerequisite-lookups)
5. [Z3 storage for documents](#5-z3-storage-for-documents)
6. [Global templates: the visit narrative](#6-global-templates-the-visit-narrative)
7. [Per-module synthesis (what templates don't carry)](#7-per-module-synthesis-what-templates-dont-carry)
8. [External-system caveats](#8-external-system-caveats)
9. [Orchestration: putting it all together](#9-orchestration-putting-it-all-together)
10. [Appendix A — Zambda quick reference](#appendix-a--zambda-quick-reference)
11. [Appendix B — SDK methods used](#appendix-b--sdk-methods-used)

---

## 1. Setup and conventions

### 1.1 Install the Oystehr SDK

```bash
npm install @oystehr/sdk
```

### 1.2 Mint an M2M access token (Oystehr IAM, OAuth 2.0 Client Credentials)

The synthesizer authenticates as a Machine-to-Machine client. Provision an M2M client through the Oystehr Console with the roles your script needs (FHIR write, Z3 write, zambda execute), then mint an access token:

```ts
async function mintM2MToken(env: NodeJS.ProcessEnv): Promise<string> {
  const resp = await fetch('https://auth.zapehr.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id:     env.OYSTEHR_M2M_CLIENT_ID,
      client_secret: env.OYSTEHR_M2M_CLIENT_SECRET,
      audience:      env.OYSTEHR_M2M_AUDIENCE,
    }),
  });
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status} ${await resp.text()}`);
  const { access_token } = await resp.json();
  return access_token;
}
```

### 1.3 Construct the SDK client

```ts
import Oystehr from '@oystehr/sdk';

const oystehr = new Oystehr({
  accessToken: m2mToken,
  projectApi:  process.env.PROJECT_API,   // e.g. https://project-api.zapehr.com/v1
  fhirApi:     process.env.FHIR_API,       // optional — defaults from projectApi
});
```

The single `oystehr` instance is the gateway to FHIR, zambdas, Z3, and IAM operations throughout this doc.

### 1.4 Invoking a zambda

```ts
const result = await oystehr.zambda.execute({
  id: 'apply-template',
  encounterId,
  templateName: 'URI Walk-in Standard',
  examType:    'inPerson',
});
```

The SDK takes care of the auth header, project routing, response parsing, and structured error reporting (`OystehrSdkError` with status code).

If you need to invoke a zambda directly (e.g., from outside the SDK ecosystem):

```
POST https://project-api.zapehr.com/v1/zambda/<zambda-id>/execute
Authorization: Bearer <m2mToken>
x-zapehr-project-id: <projectId>
Content-Type: application/json

{ ...body }
```

In local development the URL is `http://localhost:3000/local/zambda/<name>/execute`.

### 1.5 Conventions in this doc

For every zambda we describe:

- **Zambda id** — the name passed to `oystehr.zambda.execute({ id: ... })`
- **Source** — file path under `packages/zambdas/src/` for cross-reference
- **Auth context** — what identity the zambda assumes (M2M is the default for synthesis)
- **Input** — the body keys (full schema in the source's `validateRequestParameters.ts`)
- **What it produces** — the FHIR resources written and any side effects
- **When to call** — synthesis-specific guidance

For FHIR operations (search, get, create, patch, transaction) and Z3 operations (uploadFile, downloadFile), we use the SDK's `oystehr.fhir.*` and `oystehr.z3.*` methods.

### 1.6 The synthesized example throughout

All examples in this doc target the same patient and visit:

- **Patient**: Jane A Doe, 35F, born 1990-05-15, Trenton NJ, BCBS PPO insured
- **Visit**: Walk-in, in-person, urgent-care service category, on 2026-04-25
- **Reason**: Sore throat × 3 days
- **Outcome**: Signed completed visit with allergies, medications, medical history, vitals, structured ROS, exam, diagnoses (J02.9, R50.9), MDM, ibuprofen administered in-house, Tdap immunization, Strep A test (negative), chest XR (normal), patient instructions, and follow-up disposition

The bulk of the visit narrative — chief complaint, HPI, ROS structure, exam findings, MDM, diagnoses, CPT/E&M, instructions — comes from a global template named (for this example) `'URI Walk-in Standard'`. The remaining patient-specific data is set explicitly.

### 1.7 Idempotency

**Zambdas are not idempotent.** Calling `save-chart-data` twice with the same input creates duplicates unless you pass each chart-data row's prior `resourceId`. `apply-template` *does* delete and rewrite the modules it owns each time it's called (so re-applying a template is non-destructive to other chart-data and produces a clean state for the templated modules).

For repeatable seed data:
1. Tag the Patient with a deterministic synth identifier on first run.
2. On rerun, search for the Patient by that identifier; if found, reuse the existing IDs.
3. Re-call `apply-template` to refresh templated modules; supply prior `resourceId` values to `save-chart-data` for non-templated rows.

See §9.5 for a complete idempotent-rerun pattern.

---

## 2. The visit lifecycle

Ottehr layers a richer custom workflow over the standard FHIR `Appointment.status` and `Encounter.status` machines. The custom "visit status" is the one shown to staff on the dashboard; it's stored in two coordinated places (Encounter.statusHistory entries and an Appointment audit-log meta tag) and drives per-status practitioner-participation periods.

### 2.1 Visit-status timeline (walk-in urgent care)

Walk-in visits skip the `pending` row that pre-booked visits go through. The lifecycle is:

```
arrived → ready → intake → ready for provider → provider → discharged → completed → (signed)
```

Each transition is driven by a `change-in-person-visit-status` zambda call, which patches Appointment.status, Encounter.status, statusHistory entries, and the practitioner participant periods.

### 2.2 Creating the appointment (start of the lifecycle)

The first step in the lifecycle is creation. Calling `create-appointment` produces Patient + Account + Coverage (for insured) + Slot + Appointment + Encounter + initial QuestionnaireResponse + RelatedPerson, atomically — exactly what the patient app produces when a patient checks in via QR scan.

```ts
const appt = await oystehr.zambda.execute({
  id: 'create-appointment',
  patient: {
    firstName:     'Jane',
    middleName:    'A',
    lastName:      'Doe',
    dateOfBirth:   '1990-05-15',
    sex:           'female',
    email:         'jane.doe.synth@example.com',
    phoneNumber:   '+15555550101',
    reasonForVisit:'Sore throat × 3 days',
    address: { line: ['123 Main St'], city: 'Trenton', state: 'NJ', postalCode: '08609' },
  },
  visitType:       'walkin',
  serviceMode:     'in-person',
  serviceCategory: 'urgent-care',
  locationID:      config.location.id,
  // slot is auto-created for walk-in; pass slotId for prebook
});

const { patientId, appointmentId, encounterId, questionnaireResponseId } = appt;
```

After this call, the visit is at status `arrived` (walk-in's initial state). The QR is `in-progress` and prefilled with whatever patient data was passed in.

### 2.3 Walking through visit-status transitions

```ts
async function walkVisitStatuses(encounterId: string) {
  for (const updatedStatus of [
    'ready', 'intake', 'ready for provider', 'provider', 'discharged', 'completed',
  ] as const) {
    await oystehr.zambda.execute({
      id: 'change-in-person-visit-status',
      encounterId,
      updatedStatus,
    });
  }
}
```

The zambda handles:
- `Appointment.status` patches (`arrived` → `checked-in` → `fulfilled`)
- `Encounter.status` patches (`arrived` → `in-progress` → `finished`)
- Appending `Encounter.statusHistory[]` entries with the per-entry visit-status extension
- Appointment audit-log meta tags (`status-update` + `critical-update-by`)
- Admitter / attender participant period start/end timestamps

Between `intake` and `ready for provider` an intake-staff Practitioner must be assigned; between `ready for provider` and `provider` a provider Practitioner must be assigned. See §2.4.

### 2.4 Practitioner assignment

```ts
// Before transitioning to 'intake': assign the intake staff (admitter, ADM)
await oystehr.zambda.execute({
  id: 'assign-practitioner',
  encounterId,
  practitionerId: config.intakeStaff.id,
  userRole: [{
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
    code:   'ADM',
  }],
});

// Before transitioning to 'provider': assign the attending provider (ATND)
await oystehr.zambda.execute({
  id: 'assign-practitioner',
  encounterId,
  practitionerId: config.provider.id,
  userRole: [{
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
    code:   'ATND',
  }],
});
```

The zambda manages each participant's `Encounter.participant[].period` start and end timestamps in coordination with the visit status.

### 2.5 Reason for visit, addendum, and visit-flag extensions

The Encounter carries several Ottehr-specific extensions populated over the course of the visit:

- `reason-for-visit` (valueString)
- `addendum-note` (valueString — added at or after sign-off)
- `patient-info-confirmed` (valueBoolean — provider confirms intake info)
- `add-to-visit-note` flags (valueBoolean — per section)

These are all set through `save-chart-data` (covered in §7).

---

## 3. Sign-off

Provider sign-off is the action that locks the visit and closes the record.

### 3.1 What sign-off does

A single `sign-appointment` zambda call performs all of these:

1. Patches **Appointment**: `status: fulfilled`; replaces the `status-update` meta-tag's code with `completed`; adds the lock tag (`appointment-locked-status: APPOINTMENT_LOCKED`); refreshes the `critical-update-by` audit tag with the signing user.
2. Patches **Encounter**: `status: finished`; closes the final `statusHistory` entry; closes the attender's participant period; sets `Encounter.period.end`.
3. Creates a **Provenance**: target = Encounter, agent.role.coding.code = `verifier`, agent.who = signing Practitioner, recorded = now.
4. Creates a **Task**: code system `https://fhir.ottehr.com/CodeSystem/visit-note-pdf-and-email`, code `visit-note-pdf-and-email` — triggers the visit-note PDF subscription which generates the PDF and stores it as a `DocumentReference` in the `visit-notes` Z3 bucket.

### 3.2 Calling sign-appointment

```ts
await oystehr.zambda.execute({
  id: 'sign-appointment',
  appointmentId,
  encounterId,
  timezone: 'America/New_York',
});
```

After this call:
- The Encounter is `finished` and the Appointment carries `APPOINTMENT_LOCKED` — further chart-data edits are rejected by the EHR.
- The visit-note PDF is generated by the subscription (typically within a few seconds) and a DocumentReference appears in the patient's chart.
- `Provenance.agent.who` references whichever Practitioner the SDK's access token resolves to.

### 3.3 Attributing sign-off to a real Practitioner

For a faithful audit trail, call `sign-appointment` with a user token belonging to the actual provider:

```ts
const providerToken = await mintUserToken(config.provider.email, providerCredentials);
const providerOystehr = new Oystehr({ accessToken: providerToken, projectApi: env.PROJECT_API });
await providerOystehr.zambda.execute({ id: 'sign-appointment', appointmentId, encounterId });
```

For purely-synthetic data where the audit trail isn't important, calling with the M2M client is simpler — the visit is still locked correctly; only the Provenance.agent reference looks "machine-y" instead of named.

---

## 4. Prerequisite lookups

Before any zambda calls, the script needs to resolve the project's existing reference resources to their Oystehr-assigned IDs. These are not zambda calls; they're FHIR searches via the SDK.

### 4.1 What needs to exist

| Resource | Purpose |
| --- | --- |
| Active in-person `Location` | Encounter.location reference; Appointment routing |
| `Schedule` for the Location | Scheduling and visit creation |
| `Practitioner` with NPI (for attending provider) | Encounter.participant; sign-off Provenance.agent; required by lab/eligibility/claims |
| `Practitioner` for intake staff (NPI not required) | Encounter.participant ADM |
| Payer `Organization` (if insured) | Coverage.payor reference |
| `ChargeItemDefinition` fee schedule (optional) | Patient-responsibility computation |
| `Questionnaire` (intake-paperwork-inperson, with version) | QuestionnaireResponse.questionnaire canonical reference |
| Vaccine `Medication` catalog (if synthesizing immunizations) | Immunization.vaccineCode lookup |
| Global template `List` (matching the visit type) | Source for the visit narrative — see §6 |

### 4.2 Lookup recipes (SDK FHIR search)

The pattern for each is: search for any valid candidate, pick at random (default), or pin a specific one by env-var-supplied identifier.

#### Location

```ts
const locations = await oystehr.fhir.search<Location>({
  resourceType: 'Location',
  params: [
    { name: 'status', value: 'active' },
    { name: 'address-state:missing', value: 'false' },  // physical Locations have address.state
  ],
});
const location = pickRandom(locations.unbundle());
```

#### Schedule

```ts
const schedules = await oystehr.fhir.search<Schedule>({
  resourceType: 'Schedule',
  params: [
    { name: 'actor', value: `Location/${location.id}` },
    { name: 'active', value: 'true' },
    { name: '_sort', value: '-_lastUpdated' },
    { name: '_count', value: '1' },
  ],
});
```

#### Attending Practitioner (must have NPI)

```ts
const providers = await oystehr.fhir.search<Practitioner>({
  resourceType: 'Practitioner',
  params: [
    { name: 'active', value: 'true' },
    { name: 'name:missing', value: 'false' },
    { name: 'identifier', value: 'http://hl7.org/fhir/sid/us-npi|' },
  ],
});
const provider = pickRandom(providers.unbundle());
```

#### Intake-staff Practitioner

```ts
const intakeStaff = await oystehr.fhir.search<Practitioner>({
  resourceType: 'Practitioner',
  params: [
    { name: 'active', value: 'true' },
    { name: 'name:missing', value: 'false' },
    { name: '_id:not', value: provider.id },
  ],
});
```

#### Payer Organization (insured patients)

```ts
const payers = await oystehr.fhir.search<Organization>({
  resourceType: 'Organization',
  params: [
    { name: 'type',   value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay' },
    { name: 'active', value: 'true' },
    { name: 'name:missing', value: 'false' },
  ],
});
```

#### Intake Questionnaire and vaccine catalog

```ts
const questionnaires = await oystehr.fhir.search<Questionnaire>({
  resourceType: 'Questionnaire',
  params: [
    { name: 'url',     value: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson' },
    { name: 'version', value: '1.1.7' },
  ],
});

const vaccines = await oystehr.fhir.search<Medication>({
  resourceType: 'Medication',
  params: [{ name: 'identifier', value: 'virtual-medication-type|virtual-vaccine-inventory' }],
});
const vaccinesByCvx = new Map(
  vaccines.unbundle().map(m => [m.code?.coding?.find(c => c.system === 'http://hl7.org/fhir/sid/cvx')?.code, m])
);
```

#### Global template

Templates are FHIR `List` resources, indexed by a single project-level **holder List**. Architecture:

- **Each template** is a `List` whose `code.coding[].system` is one of:
  - `https://fhir.ottehr.com/CodeSystem/global-template-in-person` (in-person)
  - `https://fhir.ottehr.com/CodeSystem/global-template-telemed` (telemed)
  - `code.coding[].version` carries a short schema-version hash (e.g. `'062c8923'`).
  - `title` is the human-readable template name shown in the EHR admin UI.
  - `contained[]` carries the actual chart-data (Conditions, Observations, ClinicalImpressions, Communications, Procedures) the template applies.
- **The holder List** is a separate `List` resource identified by `meta.tag` with system `https://fhir.zapehr.com/r4/StructureDefinitions/global-template-list`. Its `entry[].item.reference` points to every active template `List`. There is exactly one holder list per project.
- **Discovery** — `list-templates` (§6.4) walks the holder list's entries and returns the templates matching the requested `examType`. The EHR admin UI at `/admin/global-templates` does the same.

Verify a template exists for the visit type you're synthesizing — preferred path is the zambda call (§6.4), but you can also walk FHIR directly:

```ts
const all = await oystehr.zambda.execute({
  id: 'list-templates',
  examType: 'inPerson',
  includeVersionData: false,
});
// Response is wrapped: { status: 200, output: { templates: [{ id, title, examVersion, versionData? }] } }
const templates = all.output?.templates ?? [];
const found = templates.find((t) => t.title === 'URI Walk-in Standard');
if (!found) {
  throw new Error('Template "URI Walk-in Standard" not found — see §6.3 to create one');
}
```

A template `List` resource that's NOT registered in the holder list is invisible to `list-templates`, the EHR admin UI, and `apply-template`. Templates created via `admin-create-template` are automatically registered; orphan template Lists in FHIR have to be re-linked to the holder list before they're usable.

### 4.3 Bootstrap function

```ts
type Config = {
  location:           Location;
  schedule:           Schedule;
  provider:           Practitioner;
  intakeStaff:        Practitioner;
  payer?:             Organization;
  feeSchedule?:       ChargeItemDefinition;
  intakeQuestionnaire: Questionnaire;
  vaccinesByCvx:      Map<string, Medication>;
  templateName:       string;
};

async function bootstrap(): Promise<Config> {
  return {
    location:           await pickLocation(oystehr),
    schedule:           await pickSchedule(oystehr, /* location */),
    provider:           await pickProvider(oystehr, /* location */),
    intakeStaff:        await pickIntakeStaff(oystehr, /* provider id */),
    payer:              await pickPayer(oystehr),
    feeSchedule:        await pickFeeSchedule(oystehr, /* payer id */),
    intakeQuestionnaire: await pickIntakeQuestionnaire(oystehr),
    vaccinesByCvx:      await loadVaccineCatalog(oystehr),
    templateName:       'URI Walk-in Standard',
  };
}
```

### 4.4 If a project doesn't have a candidate

For each prerequisite, fail loudly with a clear error pointing to the EHR admin path:

| Resource | Where to add via UI / IaC |
| --- | --- |
| Location, Schedule | IaC `config/oystehr/locations-and-schedules.json` + redeploy |
| Practitioner | EHR `/employees` → Add Employee (assigns NPI, role); or Oystehr Console IAM |
| Payer Organization | EHR `/admin/insurances` (`EditInsurance.tsx`) or IaC `config/oystehr/payers.json` |
| Fee schedule | EHR `/admin/fee-schedule` → create + associate to payer + add ChargeItems |
| Intake Questionnaire | IaC `config/oystehr/in-person-intake-questionnaire.json` + `npm run bump-canonical-version` + redeploy |
| Vaccine catalog | IaC `config/oystehr/vaccines.json` |
| Global template | EHR Global Templates admin (see §6.3) — built from a fully-charted reference encounter |

---

## 5. Z3 storage for documents

Files (insurance card photos, photo ID, signed consent PDFs, lab/radiology PDFs, visit-note PDF) live in Oystehr's Z3 storage.

### 5.1 Upload a file

```ts
const fileBuffer = readFileSync('insurance-front.jpg');
const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/jpeg' });

await oystehr.z3.uploadFile({
  bucketName:    `${env.PROJECT_ID}-insurance-cards`,
  'objectPath+': `${patientId}/${dateStamp}-insurance-front.jpg`,
  file:          blob,
});
```

### 5.2 The canonical baseFileUrl

After upload, the canonical reference to the file (what goes on `DocumentReference.content.attachment.url`) is:

```
${PROJECT_API}/z3/${PROJECT_ID}-${BUCKET_NAME}/${PATIENT_ID}/${DATE}-${FILE_NAME}
```

For example: `https://project-api.zapehr.com/v1/z3/proj-abc-insurance-cards/patient-123/2026-04-25-insurance-front.jpg`

This URL is stable; clients fetch it via `oystehr.z3.downloadFile(...)` (which mints a presigned URL behind the scenes).

### 5.3 Bucket → document-type mapping

| Document type | Bucket | DocumentReference `type.coding` |
| --- | --- | --- |
| Insurance card front/back | `<projectId>-insurance-cards` | `INSURANCE_CARD_CODE` |
| Photo ID | `<projectId>-photo-id-cards` | `PHOTO_ID_CARD_CODE` |
| Patient condition photo | `<projectId>-patient-photos` | `PATIENT_PHOTO_CODE` |
| Signed consent PDF | `<projectId>-consent-forms` | `patient-registration` |
| Privacy policy ack | `<projectId>-privacy-policy` | `PRIVACY_POLICY_CODE` |
| Visit note PDF (auto by sign-off) | `<projectId>-visit-notes` | `VISIT_NOTE_SUMMARY_CODE` |
| Discharge summary PDF | `<projectId>-discharge-summaries` | `DISCHARGE_SUMMARY_CODE` |
| School/work note PDF | `<projectId>-school-work-notes` | `SCHOOL_WORK_NOTE_CODE` |
| External lab report PDF | `<projectId>-labs` | LOINC `11502-2` |
| Receipt | `<projectId>-receipts` | `RECEIPT_CODE` |
| Statement | `<projectId>-statements` | `STATEMENT_CODE` |

### 5.4 Creating the corresponding DocumentReference

After a Z3 upload, create the `DocumentReference` pointing `content.attachment.url` at the canonical baseFileUrl:

```ts
await oystehr.fhir.create({
  resourceType: 'DocumentReference',
  status:       'current',
  docStatus:    'final',
  type:    { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/document-type', code: 'insurance-card', display: 'Insurance card' }] },
  subject: { reference: `Patient/${patientId}` },
  context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
  date:    new Date().toISOString(),
  content: [{
    attachment: {
      contentType: 'image/jpeg',
      url:         `${env.PROJECT_API}/z3/${env.PROJECT_ID}-insurance-cards/${patientId}/${dateStamp}-insurance-front.jpg`,
      title:       'Insurance card (front)',
    },
  }],
});
```

For school/work notes, the `save-chart-data` zambda has a dedicated path that handles DocumentReference creation; see §7.13. For the **visit-note PDF**, sign-off (§3) triggers a subscription that generates and stores it automatically.

---

## 6. Global templates: the visit narrative

A global template encapsulates the bulk of the chart-data narrative for a typical visit type. Applying a template to an encounter populates many chart fields in one zambda call, replacing the per-field synthesis work the script would otherwise need to do.

### 6.1 What a template encapsulates

A global template is a `List` resource whose `contained[]` array holds a snapshot of selected chart-data resources from a fully-charted reference encounter. When applied, the `apply-template` zambda creates fresh copies of those resources on the target encounter, retargeting subject and encounter references.

**The chart-data modules a template carries:**

| Module | Chart-data row | What the template provides |
| --- | --- | --- |
| Chief complaint | `Condition` (`chief-complaint`) | The CC text and clinical-status |
| History of present illness | `Condition` (`history-of-present-illness`) | The HPI narrative |
| Mechanism of injury | `Condition` (`mechanism-of-injury`) | The MOI narrative (when applicable) |
| Review of systems (structured) | `Observation`s (`ros-observation-field`) | Each system's denies/reports per the typical presentation |
| Physical exam findings | `Observation`s (`exam-observation-field`) | Per-finding observations (normal/abnormal) with body-site codings |
| Medical decision-making | `ClinicalImpression` (`medical-decision`) | The MDM narrative |
| Diagnoses | `Condition`s (`diagnosis`, ICD-10) + `Encounter.diagnosis[]` linkage | The diagnoses appropriate to the presentation, with `rank: 1` for primary preserved |
| CPT codes | `Procedure`s (`cpt-code`) | Billing codes for services typically performed |
| E&M code | `Procedure` (`em-code`) | Visit-level evaluation-and-management code |
| Patient instructions | `Communication`s (`patient-instruction`) | Discharge instructions for the visit type |
| Encounter extensions | `Encounter.extension` entries | Visit-type-level defaults (rare; usually patient-specific) |

A well-built template for `'URI Walk-in Standard'` covers a typical viral-pharyngitis presentation end-to-end: the CC and HPI text, all relevant ROS items checked, a normal physical exam with throat-erythema noted, MDM narrative, primary diagnosis J02.9 + secondary R50.9, CPT 87880 and E&M 99213, and standard discharge instructions.

**Apply-template's behavior:**

- Replaces the encounter's existing chart-data for the modules it owns (delete-then-create), with one exception: if the encounter already has a Chief Complaint or HPI Condition, the template's text is **appended** rather than replacing.
- Patches `Encounter.diagnosis[]` to reference the new diagnosis Conditions, preserving the primary-diagnosis `rank: 1`.
- Patches `Encounter.extension[]` to merge the template's encounter-level extensions (without overwriting non-template extensions).

**What a template does NOT carry (must be done explicitly — see §7):**

- Patient-specific data: vitals, allergies, medication history, past medical conditions, hospitalization history, surgical history, accident details
- Resources backed by FHIR types other than Observation / ClinicalImpression / Condition / Communication / Procedure: AllergyIntolerance, MedicationStatement, EpisodeOfCare, ServiceRequest (so: in-house labs, radiology, in-visit Procedures-screen entries, disposition follow-ups), DocumentReference, MedicationAdministration, Immunization
- Visit infrastructure (Patient, Account, Coverage, Slot, Appointment, Encounter, QR) and lifecycle operations (status transitions, sign-off) — those have their own zambdas covered in §2 and §3
- Per-screen `css-note` Communications
- Encounter extensions that are visit-specific (`reason-for-visit`, `addendum-note`, `patient-info-confirmed`)

Note that **screening Observations** (`additional-questions-field`) and **legacy free-text ROS Conditions** (`ros`) are also not part of templates; the modern synthesis path uses the structured ROS Observations the template carries instead.

### 6.2 Applying a template

One zambda call:

```ts
await oystehr.zambda.execute({
  id: 'apply-template',
  encounterId,
  templateName: 'URI Walk-in Standard',
  examType:    'inPerson',
});
```

| | |
| --- | --- |
| **Zambda id** | `apply-template` |
| **Source** | `packages/zambdas/src/ehr/apply-template/` |
| **Auth** | M2M acceptable |
| **Input** | `encounterId`, `templateName` (matches a template `List.title`), `examType` (`'inPerson'` or `'telemed'` — note camelCase, NOT `'IN_PERSON'`) |
| **What it produces** | Variable — depending on the template's content. Typically a CC Condition, an HPI Condition, multiple ROS Observations, multiple exam Observations, an MDM ClinicalImpression, multiple diagnosis Conditions with `Encounter.diagnosis[]` linkage, CPT and E&M Procedures, patient-instruction Communications. |
| **When to call** | After `create-appointment` and after the initial Phase 3a `save-chart-data` call (vitals, allergies, etc.). Calling apply-template *after* setting CC text via Phase 3a results in the template's CC text being appended to existing CC text — usually you want the template to be the source of truth, so apply it first and then patch any visit-specific narrative additions. |

**Idempotency**: Re-calling `apply-template` with the same template on the same encounter is non-destructive to non-templated data (allergies, vitals, etc.) and replaces the templated modules cleanly. Use it on rerun without a separate cleanup step.

### 6.3 Creating a template from a reference encounter

If the project doesn't have a template for the visit type you want, build one once:

1. **Use the EHR UI** (Global Templates admin) to walk a reference encounter through a fully-charted state — pick a representative provider, pick a representative patient (or use a synthetic one), document the standard CC / HPI / ROS / exam / MDM / diagnoses / CPT / E&M / instructions for that visit type. Don't bother with vitals, allergies, or patient-specific data.

2. **Save it as a template** via the `admin-create-template` zambda:

```ts
await oystehr.zambda.execute({
  id: 'admin-create-template',
  encounterId:  referenceEncounterId,
  templateName: 'URI Walk-in Standard',
  examType:     'inPerson',
});
```

This snapshots the reference encounter's chart-data into a new `List` resource (only the resources whose meta-tag systems are in the create-template allow-list) and registers it under the global-templates holder list.

3. **Verify the template appears** by listing:

```ts
const result = await oystehr.zambda.execute({
  id: 'list-templates',
  examType: 'inPerson',
  includeVersionData: false,    // set true to get per-template stale-version flag
});
// Note the wrapper: { status, output: { templates: [...] } }
const templates = result.output?.templates ?? [];
```

4. **Use it** from synthesis going forward.

You'll typically build a small library of templates per visit type (e.g. `'URI Walk-in Standard'`, `'Otitis Media Walk-in Standard'`, `'Strep Pharyngitis Walk-in Standard'`, `'UTI Walk-in Standard'`, `'Wound Care Walk-in Standard'`). The synthesizer picks the appropriate one per synthesized visit.

### 6.4 Template lifecycle zambdas

| Zambda id | Purpose |
| --- | --- |
| `admin-create-template` | Snapshot a fully-charted encounter into a new template |
| `admin-get-template-detail` | Fetch a template's full contained-resource list |
| `admin-rename-template` | Rename an existing template |
| `admin-delete-template` | Delete a template (does not affect encounters that already had it applied) |
| `list-templates` | List all templates for an exam type |
| `apply-template` | Apply a template to an encounter (the synthesis call) |

### 6.5 Template schema versioning

Each template carries a short version hash in `code.coding[].version` (e.g. `'062c8923'`). This represents the template's chart-data schema version — the shape of contained Observations, expected exam-field codes, ROS-field codes, etc. The current schema version is determined at zambda runtime from `examConfig` in `utils`.

`list-templates` returns *all* templates from the holder list regardless of version. When called with `includeVersionData: true`, each returned template gains a `versionData.isCurrentVersion: boolean` flag plus, if false, an `unmatchedFields` description of which exam/ROS field codes are no longer recognized.

Practical implications for synthesis:

- A template with `isCurrentVersion: false` may still apply via `apply-template`, but its contained Observations may carry codes the zambda no longer knows. Behavior is best-effort.
- The EHR admin UI shows stale templates with a visual marker — they remain editable.
- Re-saving a stale template (via the admin tool) typically resets it to the current version.
- For a fresh synthesis pipeline, prefer templates already on the current version (or rebuild any stale ones via `admin-create-template` against a properly-charted reference encounter).

### 6.6 Templates and synthesis: example flow

```ts
// 1) Bootstrap, including verifying the template exists
const config = await bootstrap(oystehr);   // throws if template not found

// 2) Phase 1 — create the appointment
const appt = await oystehr.zambda.execute({ id: 'create-appointment', /* ... */ });

// 3) Phase 3a — explicit save-chart-data for items templates can't carry
//    (vitals, allergies, medications, conditions, hospitalization, surgical history, accident,
//     procedures, disposition, css-note, encounter extensions — see §7)
await oystehr.zambda.execute({
  id: 'save-chart-data',
  encounterId: appt.encounterId,
  vitalsObservations: [/* ... */],
  allergies:          [/* ... */],
  medications:        [/* ... */],
  conditions:         [/* past PMH */],
  episodeOfCare:      [/* hospitalization */],
  surgicalHistory:    [/* ... */],
  procedures:         [/* in-visit Procedures-screen */],
  disposition:        { /* parent + follow-ups */ },
  notes:              [/* css-note Communications */],
  reasonForVisit:     'Sore throat × 3 days',
  patientInfoConfirmed: { value: true },
});

// 4) Phase 3b — apply-template for the visit narrative
await oystehr.zambda.execute({
  id: 'apply-template',
  encounterId: appt.encounterId,
  templateName: config.templateName,
  examType:    'inPerson',
});

// 5–7) Module orders, status walk, sign-off (§§7, 9)
```

---

## 7. Per-module synthesis (what templates don't carry)

This section covers everything `apply-template` does **not** handle — the patient-specific chart data, multi-resource workflows, and visit infrastructure. Most of it goes through one big `save-chart-data` call (§7.1); a handful of modules have dedicated zambdas (in-house meds, in-house labs, immunizations, radiology).

### 7.1 The save-chart-data zambda

A single `save-chart-data` call can populate every chart field in this section in one shot:

```ts
await oystehr.zambda.execute({
  id: 'save-chart-data',
  encounterId,
  // any combination of the keys below
});
```

The supported input keys for **non-templated** fields (the ones to set in Phase 3a):

| Input key | What it writes |
| --- | --- |
| `allergies` | AllergyIntolerance (`known-allergy`) |
| `medications` | MedicationStatement (`current-medication`) — patient-reported med history |
| `conditions` | Condition (`medical-condition`) — past PMH |
| `episodeOfCare` | EpisodeOfCare (`hospitalization`) |
| `surgicalHistory` | Procedure (`surgical-history`) |
| `surgicalHistoryNote` | Procedure (`surgical-history-note`) |
| `accident` | Condition (`accident`) with type / state codings |
| `vitalsObservations` | Observation (`patient-vitals-field`, with `vital-*` code per field) |
| `observations` | Observation (`additional-questions-field`) — screening |
| `procedures` | ServiceRequest (`procedure`, with all 12 extensions) — Procedures-screen |
| `disposition` | Parent ServiceRequest (`disposition-follow-up`) + sub-follow-up ServiceRequests + patches Encounter.hospitalization.dischargeDisposition |
| `notes` | Communication (`css-note`) per-screen free-text notes |
| `reasonForVisit` | Encounter.extension `reason-for-visit` |
| `addendumNote` | Encounter.extension `addendum-note` |
| `patientInfoConfirmed` | Encounter.extension `patient-info-confirmed` |
| `addToVisitNote` | Encounter.extension flags |
| `birthHistory` | Observation (`birth-history`) — pediatric only, skip for adults |

Each chart-data row optionally accepts a `resourceId` field — supply it to update an existing resource rather than creating a new one. The zambda response includes the resource ids of every created/updated resource — capture them for later updates and cleanup.

The remaining subsections below show the realistic Jane Doe payload per module.

### 7.2 Allergies

```ts
{
  allergies: [
    {
      name:     'Penicillin',
      code:     '1191',
      system:   'https://terminology.fhir.oystehr.com/CodeSystem/medispan-allergen-id',
      severity: 'severe',
      note:     'Anaphylaxis as a child — carries epinephrine auto-injector',
    },
    {
      name:     'Shellfish',
      system:   'https://terminology.fhir.oystehr.com/CodeSystem/other-allergy',
      category: 'food',
    },
  ],
  notes: [
    { code: 'allergy', text: 'Patient reports allergy worsened over the past year.' },
  ],
}
```

The free-text "Notes" field on the Allergies screen is captured via the `notes` array (system `css-note`).

### 7.3 Medication history

```ts
{
  medications: [
    {
      name:               'Lisinopril 10 MG Oral Tablet',
      code:               '262731',
      system:             'http://terminology.hl7.org/CodeSystem/medicationDispensableDrugId',
      dose:               '10mg PO once daily',
      effectiveDateTime:  '2024-06-01',
      status:             'active',
    },
    {
      name:   'Atorvastatin 20 MG Oral Tablet',
      code:   '104894',
      system: 'http://terminology.hl7.org/CodeSystem/medicationDispensableDrugId',
      dose:   '20mg PO once daily at bedtime',
      status: 'active',
      note:   'Patient could not confirm exact start date.',
    },
  ],
  notes: [
    { code: 'medication', text: 'Patient takes Lisinopril daily; reports good adherence.' },
  ],
}
```

### 7.4 Medical Conditions (past PMH)

```ts
{
  conditions: [
    { code: 'I10',   display: 'Essential hypertension', system: 'http://hl7.org/fhir/sid/icd-10' },
    { code: 'E78.5', display: 'Hyperlipidemia, unspecified', system: 'http://hl7.org/fhir/sid/icd-10' },
  ],
}
```

### 7.5 Hospitalization (past inpatient stays)

```ts
{
  episodeOfCare: [
    { display: 'Pneumonia, hospitalized 2023' },
  ],
}
```

### 7.6 Surgical History

```ts
{
  surgicalHistory: [
    { display: 'Appendectomy, 2018' },
  ],
  surgicalHistoryNote: { text: 'Tonsillectomy planned 2019, cancelled.' },
}
```

### 7.7 Accident details

Only for traumatic / accident-related visits (not the URI example):

```ts
{
  accident: {
    type:  ['auto-accident'],
    state: 'NJ',
    date:  '2026-04-25',
  },
}
```

### 7.8 Vitals

Vitals are intentionally not in templates — they're patient-specific and recorded per visit.

```ts
{
  vitalsObservations: [
    { field: 'vital-temperature',       value: 37.4, unit: 'C', method: '89003005' /* SNOMED oral */ },
    { field: 'vital-heartbeat',         value: 76, unit: '/min' },
    { field: 'vital-blood-pressure',    value: { systolic: 118, diastolic: 76 }, unit: 'mm[Hg]' },
    { field: 'vital-oxygen-sat',        value: 99, unit: '%', method: '250590007' /* SNOMED room air */ },
    { field: 'vital-respiration-rate',  value: 16, unit: '/min' },
    { field: 'vital-weight',            value: 65, unit: 'kg' },
    { field: 'vital-height',            value: 168, unit: 'cm' },
  ],
}
```

The full set of vital field codes is defined in `packages/utils/lib/types/api/chart-data/chart-data.constants.ts` as the `VitalFieldNames` enum.

### 7.9 Screening / additional questions

```ts
{
  observations: [
    { field: 'tobacco-use', value: false },
    // additional screening items as needed
  ],
}
```

### 7.10 Procedures performed in this visit (Procedures-screen ServiceRequest)

The Procedures screen captures procedures performed *during this visit* with rich structured metadata. The resource is a `ServiceRequest` with up to 12 extensions — not a Procedure — so it doesn't fit in templates and must be supplied here:

```ts
{
  procedures: [{
    procedureType:    'throat-swab-collection',
    occurrenceDateTime: '2026-04-25T14:25:00Z',
    documentedDateTime: '2026-04-25T14:30:00Z',
    performerType:    'Provider',
    bodySite:         'pharynx',
    technique:        ['swabbing'],
    suppliesUsed:     'Sterile swab',
    procedureDetails: 'Throat swab obtained from posterior pharynx with sterile swab.',
    specimenSent:     true,
    complications:    'None',
    patientResponse:  'Tolerated procedure well',
    timeSpent:        '2 minutes',
    documentedBy:     'Provider',
    consentObtained:  true,
    diagnoses:        [{ resourceId: '<diagnosis-condition-id-from-template>' }],
    cptCodes:         [{ resourceId: '<cpt-procedure-id-from-template>' }],
  }],
}
```

The `diagnoses` and `cptCodes` arrays cross-reference Conditions and CPT Procedures created **by the template** (`apply-template` returns the new ids in its response). Capture them when calling apply-template and reference them here.

### 7.11 Disposition / follow-up

The `disposition` payload produces three coordinated changes: a parent `ServiceRequest`, sub-follow-up `ServiceRequest`s, and a patch to `Encounter.hospitalization.dischargeDisposition`. None fit in templates (`ServiceRequest` isn't a templated type).

```ts
{
  disposition: {
    type: 'home',
    text: 'Discharge home',
    note: 'Patient stable for discharge.',
    followUp: [{ type: 'primary-care', note: 'Follow up with PCP if no improvement in 5 days' }],
  },
}
```

### 7.12 Per-screen free-text Notes (css-note)

Several screens (Allergies, Medications, Medical Conditions, Hospitalization, Vitals, Screening, plus a provider-internal note) have a free-text "Notes" field at the bottom. These don't fit in templates:

```ts
{
  notes: [
    { code: 'allergy',          text: 'Patient reports allergy worsened over the past year.' },
    { code: 'medication',       text: 'Patient takes Lisinopril daily; reports good adherence.' },
    { code: 'internal',         text: 'Provider-only: patient seemed anxious about strep result.' },
  ],
}
```

Note types: `allergy`, `medication`, `medical-condition`, `hospitalization`, `intake`, `vitals`, `screening`, `internal`.

### 7.13 Encounter extensions (reason for visit, addendum, info-confirmed)

Visit-specific extensions:

```ts
{
  reasonForVisit:       'Sore throat × 3 days',
  patientInfoConfirmed: { value: true },
  addendumNote:         { text: 'Patient called back at 4 PM to confirm she would start ibuprofen as instructed.' },
}
```

### 7.14 Documents and DocumentReferences

For most attachments — insurance card photos, photo ID, signed consent PDFs — the synthesizer:
1. Uploads the file to Z3 via `oystehr.z3.uploadFile()` (§5.1).
2. Creates the corresponding `DocumentReference` via `oystehr.fhir.create()` (§5.4).

For school/work notes specifically, `save-chart-data` has dedicated `newSchoolWorkNote` / `schoolWorkNotes` keys that generate the PDF, upload to Z3, and create the DocumentReference in one call.

For the **visit-note PDF**, sign-off (§3) triggers a subscription that generates and stores it automatically.

### 7.15 In-house medications

```ts
const order = await oystehr.zambda.execute({
  id: 'create-update-medication-order',
  orderId: null,
  newStatus: 'administered',
  orderData: {
    patient:           patientId,
    encounterId,
    medicationId:      'ibuprofen-400mg',
    dose:              400,
    units:             'mg',
    route:             '26643006',        // SNOMED Oral
    effectiveDateTime: '2026-04-25T14:50:00Z',
    orderingProviderId: config.provider.id,
    administeringProviderId: config.intakeStaff.id,
    reason: 'Pyrexia and pharyngeal pain',
    reasonReference: [{ resourceId: '<diagnosis-id-from-template>' }],
  },
});
```

### 7.16 Immunizations

```ts
const order = await oystehr.zambda.execute({
  id: 'immunization/create-update-order',
  orderId: null,
  details: {
    encounterId,
    vaccineCode: '115',
    medicationId: config.vaccinesByCvx.get('115')?.id,
    lotNumber:    'U7034AA',
    expirationDate: '2027-06-30',
    manufacturer: 'Sanofi Pasteur (Adacel)',
  },
});

await oystehr.zambda.execute({
  id: 'immunization/administer-order',
  orderId: order.id,
  administrationDetails: {
    effectiveDateTime: '2026-04-25T15:00:00Z',
    site:  '368208006',
    route: '78421000',
    dose:  { value: 0.5, unit: 'mL' },
    administeredBy: config.intakeStaff.id,
    visDate: '2024-08-06',
  },
});
```

### 7.17 In-house labs

```ts
const resources = await oystehr.zambda.execute({
  id: 'get-create-in-house-lab-order-resources',
  encounterId,
});
const strepTestId = resources.tests.find(t => t.name === 'Rapid Strep A').id;

const order = await oystehr.zambda.execute({
  id: 'create-in-house-lab-order',
  encounterId,
  selectedTests: [strepTestId],
  notes: '',
});

await oystehr.zambda.execute({
  id: 'collect-in-house-lab-specimen',
  serviceRequestId: order.serviceRequestId,
  specimenType:     'throat-swab',
  collectedDateTime: '2026-04-25T14:00:00Z',
  collectedBy:      config.intakeStaff.id,
});

await oystehr.zambda.execute({
  id: 'handle-in-house-lab-results',
  serviceRequestId: order.serviceRequestId,
  results: [{ field: 'strep-a-result', value: 'negative', interpretation: 'normal' }],
  status: 'final',
});
```

### 7.18 Radiology

```ts
const order = await oystehr.zambda.execute({
  id: 'radiology/create-order',
  encounterId,
  procedureCode: '71046',           // CPT
  modality:      'DX',              // DICOM
  reasonCode:    [{ code: 'R05', system: 'http://hl7.org/fhir/sid/icd-10', display: 'Cough' }],
  priority:      'routine',
  clinicalHistory: 'Sore throat with cervical adenopathy; rule out infectious source',
  notes: '',
});

await oystehr.zambda.execute({
  id: 'radiology/save-preliminary-report',
  serviceRequestId: order.serviceRequestId,
  conclusion: 'No acute cardiopulmonary process. Heart size normal. Lungs clear.',
  reportData: '<base64 HTML report>',
});

await oystehr.zambda.execute({
  id: 'radiology/send-for-final-read',
  serviceRequestId: order.serviceRequestId,
});
```

`radiology/launch-viewer` requires a real AdvaPACS connection and will fail with a synthesized accession. Acceptable — every other UI element renders correctly.

### 7.19 Coverage and Account (insured patients)

For walk-in urgent-care, `create-appointment` (§2.2) creates the Account. If the patient indicates insurance during intake, the harvest flow creates the Coverage; if self-pay, no Coverage is created.

For pure synthesis, create the Coverage directly:

```ts
const coverage = await oystehr.fhir.create<Coverage>({
  resourceType: 'Coverage',
  status:       'active',
  type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'PPO' }] },
  subscriber:   { reference: `Patient/${patientId}` },
  beneficiary:  { reference: `Patient/${patientId}` },
  subscriberId: 'BC-987654321',
  identifier:   [{
    type:   { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MB', display: 'Member Number' }] },
    value:  'BC-987654321',
  }],
  relationship: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship', code: 'self' }] },
  payor:        [{ reference: `Organization/${config.payer.id}` }],
  order:        1,
});

await oystehr.fhir.patch({
  resourceType: 'Account',
  id: accountId,
  operations: [
    { op: 'add', path: '/coverage', value: [{ coverage: { reference: `Coverage/${coverage.id}` }, priority: 1 }] },
  ],
});

await oystehr.fhir.patch({
  resourceType: 'Encounter',
  id: encounterId,
  operations: [
    { op: 'add', path: '/account', value: [{ reference: `Account/${accountId}` }] },
    { op: 'add', path: '/extension/-', value: { url: 'https://fhir.ottehr.com/Extension/payment-variant', valueString: 'insurance' } },
  ],
});
```

For self-pay synthesis, omit the Coverage entirely and set `payment-variant` to `"self-pay"`.

### 7.20 Eligibility (rich demo-quality scenario)

The Visit Details patient-payment widget reads eligibility from two custom extensions on `CoverageEligibilityResponse` carrying Candid Health-formatted JSON: `https://extensions.fhir.oystehr.com/raw-request` and `https://extensions.fhir.oystehr.com/raw-response`. The widget reads `JSON.parse(rawResponse).elig.benefit[]` and filters/displays per service-type code (`benefit_code`) and coverage code (`benefit_coverage_code`: `'1'` Active Coverage / `'A'` Co-Insurance / `'B'` Co-Pay / `'C'` Deductible / `'G'` Out-of-Pocket Max).

**For a strong demo we want a multi-service-code response** that exercises every patient-responsibility scenario across the visit's CPT codes. Here's the full eligibility synthesis:

```ts
// Helper to build one Candid-format benefit entry
function eligBenefit(opts: {
  coverageCode: '1' | 'A' | 'B' | 'C' | 'G';
  serviceCode:  string;        // X12 service-type code (UC, 30, 5, 73, etc.)
  description:  string;
  inNetwork:    boolean;
  amount?:      number;        // dollar amount (copay/deductible)
  percent?:     number;        // percentage (co-insurance)
  period?:      string;        // 'Visit' / 'Calendar Year' / 'Lifetime'
  remainingAmount?: number;    // for deductible / OOP max — amount NOT yet met
  policyNumber?: string;
}): Record<string, unknown> {
  return {
    benefit_coverage_code:        opts.coverageCode,
    benefit_code:                 opts.serviceCode,
    benefit_description:          opts.description,
    benefit_amount:               opts.amount        ?? 0,
    benefit_percent:              opts.percent       ?? 0,
    benefit_period_description:   opts.period        ?? 'Visit',
    benefit_period_code:          { Visit: '27', 'Calendar Year': '23', Lifetime: '32' }[opts.period ?? 'Visit'],
    inplan_network:               opts.inNetwork ? 'Y' : 'N',
    benefit_level_code:           'IND',
    benefit_level_description:    'Individual',
    benefit_coverage_description: opts.description,
    insurance_type_code:          '12',
    insurance_type_description:   'PPO',
    policy_number:                opts.policyNumber ?? 'BC-987654321',
    entity_name:                  ['BlueCross BlueShield of NJ'],
    entity_id:                    ['BCBSNJ'],
    entity_addr_1:                ['1 Insurance Way'],
    entity_city:                  'Newark',
    entity_state:                 'NJ',
    entity_zip:                   '07101',
    entity_phone:                 ['1-800-555-0100'],
    entity_website:               ['https://www.bcbsnj.com'],
    entity_fax:                   ['1-800-555-0101'],
    ...(opts.remainingAmount !== undefined ? { benefit_remaining_amount: opts.remainingAmount } : {}),
  };
}

const eligRawRequest = {
  pat_name_f:  'Jane',
  pat_name_m:  'A',
  pat_name_l:  'Doe',
  pat_dob:     '19900515',          // YYYYMMDD
  pat_sex:     'F',
  ins_number:  'BC-987654321',
  payer_id:    'BCBSNJ',
  service_date:'20260425',
  provider_npi: config.provider.npi,
  provider_taxonomy: '208D00000X',
};

const eligRawResponse = {
  elig: {
    coverage_status:          '1',
    coverage_status_label:    'Active Coverage',
    plan_number:              'PPO-GOLD-2026',
    eligibility_begin_date:   '20260101',
    eligibility_end_date:     '20261231',
    ins_name_f:               'Jane',
    ins_name_m:               'A',
    ins_name_l:               'Doe',
    ins_dob:                  '19900515',
    ins_number:               'BC-987654321',
    ins_addr_1:               '123 Main St',
    ins_city:                 'Trenton',
    ins_state:                'NJ',
    ins_zip:                  '08609',
    benefit: [
      // 1. Active Coverage — confirms policy in force
      eligBenefit({ coverageCode: '1', serviceCode: '30', description: 'Active Coverage — Health Benefit Plan',  inNetwork: true,  period: 'Calendar Year' }),
      eligBenefit({ coverageCode: '1', serviceCode: '30', description: 'Active Coverage — Health Benefit Plan',  inNetwork: false, period: 'Calendar Year' }),

      // 2. Annual Deductible — $1,500 with $800 already met
      eligBenefit({ coverageCode: 'C', serviceCode: '30', description: 'Annual Deductible',                       inNetwork: true,  amount: 1500, period: 'Calendar Year', remainingAmount: 700 }),
      eligBenefit({ coverageCode: 'C', serviceCode: '30', description: 'Annual Deductible',                       inNetwork: false, amount: 3000, period: 'Calendar Year', remainingAmount: 3000 }),

      // 3. Out-of-Pocket Max
      eligBenefit({ coverageCode: 'G', serviceCode: '30', description: 'Annual Out-of-Pocket Maximum',           inNetwork: true,  amount: 5000, period: 'Calendar Year', remainingAmount: 4200 }),
      eligBenefit({ coverageCode: 'G', serviceCode: '30', description: 'Annual Out-of-Pocket Maximum',           inNetwork: false, amount: 10000, period: 'Calendar Year', remainingAmount: 10000 }),

      // 4. Office visit copay (general)
      eligBenefit({ coverageCode: 'B', serviceCode: 'OV', description: 'Office Visit Co-Pay',                    inNetwork: true,  amount: 25 }),
      eligBenefit({ coverageCode: 'B', serviceCode: 'OV', description: 'Office Visit Co-Pay',                    inNetwork: false, amount: 50 }),

      // 5. Urgent Care copay (the CopayWidget filters specifically to UC)
      eligBenefit({ coverageCode: 'B', serviceCode: 'UC', description: 'Urgent Care Co-Pay',                     inNetwork: true,  amount: 25 }),
      eligBenefit({ coverageCode: 'B', serviceCode: 'UC', description: 'Urgent Care Co-Pay',                     inNetwork: false, amount: 75 }),

      // 6. Diagnostic Lab — covered, no copay (after deductible)
      eligBenefit({ coverageCode: 'B', serviceCode: '5',  description: 'Diagnostic Lab',                          inNetwork: true,  amount: 0 }),
      eligBenefit({ coverageCode: 'A', serviceCode: '5',  description: 'Diagnostic Lab — Co-Insurance',           inNetwork: false, percent: 30 }),

      // 7. Diagnostic X-Ray / Radiology — 20% co-insurance after deductible
      eligBenefit({ coverageCode: 'A', serviceCode: '73', description: 'Diagnostic X-Ray — Co-Insurance',         inNetwork: true,  percent: 20 }),
      eligBenefit({ coverageCode: 'A', serviceCode: '73', description: 'Diagnostic X-Ray — Co-Insurance',         inNetwork: false, percent: 50 }),

      // 8. Immunizations — covered 100%, no patient responsibility
      eligBenefit({ coverageCode: 'B', serviceCode: 'BG', description: 'Immunizations',                          inNetwork: true,  amount: 0 }),
      eligBenefit({ coverageCode: 'A', serviceCode: 'BG', description: 'Immunizations — Co-Insurance',           inNetwork: false, percent: 50 }),
    ],
  },
};

const eligReq = await oystehr.fhir.create<CoverageEligibilityRequest>({
  resourceType: 'CoverageEligibilityRequest',
  status:       'active',
  purpose:      ['benefits'],
  patient:      { reference: `Patient/${patientId}` },
  servicedDate: '2026-04-25',
  created:      new Date().toISOString(),
  provider:     { reference: `Practitioner/${config.provider.id}` },
  insurer:      { reference: `Organization/${config.payer.id}` },
  insurance:    [{ coverage: { reference: `Coverage/${coverage.id}` } }],
});

await oystehr.fhir.create<CoverageEligibilityResponse>({
  resourceType: 'CoverageEligibilityResponse',
  status:       'active',
  purpose:      ['benefits'],
  patient:      { reference: `Patient/${patientId}` },
  created:      new Date().toISOString(),
  request:      { reference: `CoverageEligibilityRequest/${eligReq.id}` },
  outcome:      'complete',
  disposition:  'Eligible',
  insurer:      { reference: `Organization/${config.payer.id}` },
  // The two extensions the EHR's parseEligibilityResponse reads — these power the
  // CopayWidget and the eligibility-details dialog.
  extension: [
    { url: 'https://extensions.fhir.oystehr.com/raw-request',  valueString: JSON.stringify(eligRawRequest) },
    { url: 'https://extensions.fhir.oystehr.com/raw-response', valueString: JSON.stringify(eligRawResponse) },
  ],
  insurance: [{
    coverage: { reference: `Coverage/${coverage.id}` },
    inforce:  true,
    extension: [{
      url: 'https://extensions.fhir.oystehr.com/eligibility-insurance-type',
      valueCoding: { system: 'https://terminology.fhir.oystehr.com/CodeSystem/eligibility-insurance-type', code: 'Commercial' },
    }],
  }],
});
```

#### What this drives in the EHR display

- **CopayWidget** (Visit Details + progress note): renders the `'UC'` urgent-care copay, both in-network ($25) and out-of-network ($75) panels.
- **Eligibility Details dialog**: shows the full benefit breakdown — active coverage, deductible status, OOP max, plus the per-service-type copays / co-insurance for office visit, lab, radiology, and immunizations.
- **Patient info card**: shows the BCBS NJ payer details, plan number `PPO-GOLD-2026`, eligibility window `2026-01-01` to `2026-12-31`, member ID, in-network status.

X12 Service-Type code reference for the values used above:

| Code | Meaning |
| --- | --- |
| `'1'` | Active Coverage (all policy types) |
| `'30'` | Health Benefit Plan Coverage (general) |
| `'OV'` | Office Visit |
| `'UC'` | Urgent Care |
| `'5'` | Diagnostic Lab |
| `'73'` | Diagnostic X-Ray |
| `'BG'` | Immunizations |
| `'BB'` | Specialty Drugs |
| `'AL'` | Allergy / Vision (varies) |
| `'A'` Coverage | Co-Insurance (percentage) |
| `'B'` Coverage | Co-Payment (fixed dollar) |
| `'C'` Coverage | Deductible |
| `'G'` Coverage | Out-of-Pocket Max |

To customize the demo for different scenarios:
- **Self-pay patient**: skip the entire eligibility section (no Coverage, no eligibility resources).
- **Deductible-not-yet-met**: change `remainingAmount` on the deductible benefit to the full $1500 and reduce the OOP-max remaining to `$0` met YTD — the radiology charge in §7.21 then comes out of the deductible at the full allowed amount.
- **Out-of-network visit**: synthesize the patient with an in-network policy but the location's PractitionerRole tagged out-of-network; the `inNetwork: false` panel then drives the visit's costs.
- **High-deductible HSA plan**: use `insurance_type_code: 'HM'` (HMO) or a custom plan type; set deductible $7000, remaining $7000; all CPTs come out of pocket up to the deductible.

### 7.21 Charge master and fee schedule for the visit's CPT codes

The patient-responsibility computation needs **two pieces of pricing data** for every CPT performed in the visit:

1. **Charge master** (`ChargeItemDefinition` with `meta.tag` `charge-master`) — the project's billed amount per CPT. This is what shows up under "Charges" on the Visit Details and on the patient-facing receipt.
2. **Fee schedule** (`ChargeItemDefinition` with `meta.tag` `fee-schedule`, associated with a payer via `useContext`) — the negotiated allowed amount per CPT for that payer. The fee schedule is what insurance pays toward.

Both are looked up at view-time:

```ts
const feeSchedule = await oystehr.zambda.execute({
  id: 'find-applicable-fee-schedule',
  payerOrganizationId: config.payer.id,
  dateOfService:       '2026-04-25',
});

const chargeMaster = await oystehr.zambda.execute({
  id: 'find-applicable-charge-master',
  payerOrganizationId: config.payer.id,
  dateOfService:       '2026-04-25',
});
```

Both return a `ChargeItemDefinition` whose `propertyGroup[].priceComponent[]` lists CPT-coded line items with prices.

#### Verifying the visit's CPTs are priced

For the demo visit, the CPTs performed are:

| CPT | Description | Source |
| --- | --- | --- |
| `99213` | Office visit, established patient, low MDM | E&M code (template) |
| `87880` | Strep A rapid test | In-house lab + CPT (template) |
| `71046` | Chest XR, two views | Radiology order |
| `90471` | Immunization administration | Immunization given |

Each must appear in **both** the project's charge master *and* the picked payer's fee schedule. Verify after `find-applicable-*`:

```ts
function ensureCptPriced(cid: ChargeItemDefinition, cpt: string): number | null {
  const pg = cid.propertyGroup?.find(g =>
    g.priceComponent?.[0]?.code?.coding?.some(c =>
      c.system === 'http://www.ama-assn.org/go/cpt' && c.code === cpt
    )
  );
  return pg?.priceComponent?.[0]?.amount?.value ?? null;
}

for (const cpt of ['99213', '87880', '71046', '90471']) {
  const charge  = ensureCptPriced(chargeMaster.feeSchedule, cpt);   // billed
  const allowed = ensureCptPriced(feeSchedule.feeSchedule,  cpt);   // negotiated
  if (charge === null || allowed === null) {
    throw new Error(`CPT ${cpt} missing from charge master or fee schedule`);
  }
}
```

#### Seeding missing CPTs (only if absent)

If the project's charge master or fee schedule doesn't carry one of the visit's CPTs, seed it via the RCM zambdas:

```ts
// Add to charge master
await oystehr.zambda.execute({
  id: 'cm-add-procedure-code',
  chargeMasterId: chargeMaster.feeSchedule.id,
  code:           '99213',
  description:    'Office visit, established patient, low MDM',
  amount:         150,
});

// Add to fee schedule (payer-specific allowed amount)
await oystehr.zambda.execute({
  id: 'add-procedure-code',
  feeScheduleId: feeSchedule.feeSchedule.id,
  code:          '99213',
  description:   'Office visit, established patient, low MDM',
  amount:        95,
});
```

For demo purposes the doc recommends seeding once at project setup — every project should have the common urgent-care CPTs priced. The seed script is a one-time admin task; the synthesis script just verifies and fails loudly if anything is missing.

#### Demo pricing for the visit's CPTs

Using realistic-looking prices for an urgent-care project:

| CPT | Charge master (billed) | Fee schedule (allowed for BCBS PPO) |
| --- | --- | --- |
| `99213` | `$150` | `$95` |
| `87880` | `$35`  | `$20` |
| `71046` | `$200` | `$135` |
| `90471` | `$30`  | `$20` |

#### Computed patient responsibility — what the EHR displays

The Visit Details widget combines the eligibility benefits (§7.20) with the fee-schedule allowed amounts above to produce the per-CPT breakdown. For the demo scenario (BCBS PPO patient, in-network, $800 of $1500 deductible already met):

```
                                                                           Patient    Insurance
CPT     Description                Service code   Charged    Allowed       owes       owes
─────────────────────────────────────────────────────────────────────────────────────────────────
99213   E&M, established patient   OV / UC        $150       $95           $25.00     $70.00
                                                                           (UC copay)
87880   Strep A rapid test         5 (Lab)        $35        $20           $0.00      $20.00
                                                                           (covered)
71046   Chest XR, PA + lateral     73 (X-Ray)     $200       $135          $27.00     $108.00
                                                                           (20% co-ins,
                                                                            ded. met)
90471   Immunization admin         BG (Immun)     $30        $20           $0.00      $20.00
                                                                           (covered)
─────────────────────────────────────────────────────────────────────────────────────────────────
Total                                             $415       $270          $52.00     $218.00
```

**The narrative this enables in a demo:**

> "Jane Doe walked into urgent care with a sore throat. The office visit, strep test, chest x-ray, and Tdap immunization together would have been billed at $415. Her BCBS PPO plan's negotiated rates bring the allowed amount to $270 in-network, and Ottehr — pulling Jane's real-time eligibility — knows her urgent-care copay is $25, that diagnostic labs and immunizations are covered at no cost, that radiology is at 20% co-insurance after deductible, and that her deductible is already met for the year. So the EHR tells the front-desk staff that **Jane owes $52** today, and **insurance is responsible for the remaining $218**, before she even walks out."

#### Adapting the demo

| Change | Effect |
| --- | --- |
| Set deductible-remaining to $1500 (unmet) | Radiology + co-insurance scenarios collapse — patient pays full allowed amount on every line until $1500 is met |
| Switch payer to a different fee schedule | Allowed amounts change → patient/insurance split shifts |
| Make patient self-pay | All charges roll to patient at charge-master prices ($415 total) |
| Add a vaccine-not-covered scenario | Set `serviceCode: 'BG'` benefit to `coverageCode: 'I'` (Non-Covered) — patient owes full $20 allowed on 90471 |
| Out-of-network demo | Use the `inNetwork: false` benefit panel — much higher patient share |

The ChargeItem / Invoice / PaymentNotice resources are *not* synthesized per visit. The Visit Details widget computes the breakdown live from the visit's `Procedure` resources tagged `cpt-code` + the picked payer's fee schedule + the eligibility response. As long as those three are populated correctly, the patient-responsibility display is fully accurate.

### 7.22 Visit-narrative polish (for a demo-ready record)

A small handful of additional touches make the difference between a synthesized visit that *technically* renders and one that looks like a real, fully-charted patient encounter. Each is independent — pick what's worth the demo.

#### 7.22.1 Populate the insurance answers in the intake QuestionnaireResponse

The progress note's Visit Details section reads two link IDs from the encounter's `QuestionnaireResponse`:

- `insurance-carrier` — displayed as the "Insurance Company" field
- `insurance-member-id` — displayed as the "Subscriber ID" field

`create-appointment` creates the QR with `status: in-progress` but doesn't fill these answers (the patient app would normally populate them during the insurance-paperwork page, which we skip). Without them, the Visit Details section on the signed progress note shows blank insurance fields — visible on the visit-note PDF too.

After `create-appointment` and after creating the Coverage (§7.19), patch the QR:

```ts
await oystehr.fhir.patch({
  resourceType: 'QuestionnaireResponse',
  id: questionnaireResponseId,
  operations: [{
    op: 'add',
    path: '/item/-',
    value: {
      linkId: 'insurance-section',
      item: [
        { linkId: 'insurance-carrier',  answer: [{ valueString: config.payer.id }] },
        { linkId: 'insurance-member-id', answer: [{ valueString: 'BC-987654321' }] },
      ],
    },
  }],
});
```

The carrier answer stores the payer Organization ID (the EHR's `useGetInsurancePlan` hook resolves this to the Organization's name); the member ID is the same value used on `Coverage.subscriberId`.

For richer demos, also populate the patient-address answer (`patient-street-address`) — the `VisitDetailsContainer` displays it as the visit's "Address: ...".

#### 7.22.2 Appointment notes (staff annotations)

Visit Details has an **Appointment notes history** panel — a chronological list of provider/staff annotations attached to the appointment. Empty by default. One or two short notes per visit phase makes the panel feel lived-in:

```ts
const noteTimes = [
  { time: '13:18', text: 'Vital signs stable; afebrile.' },
  { time: '13:50', text: 'Provider in room with patient.' },
];

for (const { time, text } of noteTimes) {
  await oystehr.fhir.create<Communication>({
    resourceType: 'Communication',
    status:    'completed',
    subject:   { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    about:     [{ reference: `Appointment/${appointmentId}` }],
    sender:    { reference: `Practitioner/${config.intakeStaff.id}` },
    sent:      `2026-04-25T${time}:00Z`,
    payload:   [{ contentString: text }],
    meta: { tag: [{ system: 'css-note', code: 'appointment-note' }] },
  });
}
```

The notes panel reads Communications with `about` referencing the Appointment and renders them in chronological order with author + timestamp.

#### 7.22.3 Patient-education PDFs

The patient-education feature is one of Ottehr's strongest visit-end demos. For each diagnosis, the `generate-patient-education` zambda calls Vertex AI with MedlinePlus links to produce a patient-friendly handout, and `save-patient-education-pdf` stores it as a DocumentReference linked to the encounter. The progress note's `PatientInstructionsContainer` renders these inline as clickable PDF links beside the typed instructions.

For each diagnosis the visit produced (these come from the template — capture their Condition resources after `apply-template`):

```ts
const diagnoses = await oystehr.fhir.search<Condition>({
  resourceType: 'Condition',
  params: [
    { name: 'encounter', value: `Encounter/${encounterId}` },
    { name: '_tag',      value: `https://fhir.zapehr.com/r4/StructureDefinitions/diagnosis|diagnosis` },
  ],
}).then(b => b.unbundle());

for (const dx of diagnoses) {
  const icd = dx.code?.coding?.find(c => c.system === 'http://hl7.org/fhir/sid/icd-10');
  if (!icd?.code) continue;

  // 1) Generate content via MedlinePlus + Vertex AI
  const education = await oystehr.zambda.execute({
    id: 'generate-patient-education',
    icdCode:        icd.code,
    icdDescription: icd.display ?? '',
  });
  if (!education.content) continue;   // no MedlinePlus material for that ICD

  // 2) Save as a DocumentReference attached to the encounter, linked to the
  //    relevant Communication (patient-instruction) so the PatientInstructionsContainer
  //    renders the PDF link inline
  await oystehr.zambda.execute({
    id: 'save-patient-education-pdf',
    encounterId,
    patientId,
    icdCode:      education.icdCode,
    icdDescription: education.icdDescription,
    patientTitle: education.patientTitle,
    content:      education.content,
    links:        education.links,
  });
}
```

For the Jane Doe URI visit this generates a "Caring for Your Sore Throat" PDF for J02.9 and a similar one for R50.9 (Fever).

> **Prerequisite**: requires `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_CLOUD_API_KEY` configured as zambda secrets, with the API key authorized for Vertex AI Express in that project. See `packages/zambdas/src/shared/ai.ts:123` for the call. If credentials aren't set up, skip this section — the visit still renders fine without education PDFs.

#### 7.22.4 Financial-responsibility consent (third consent)

Most projects have three consent forms signed at intake (HIPAA acknowledgement, consent-to-treat, financial-responsibility). The synthesis covers HIPAA + consent-to-treat (§5). Adding a financial-responsibility consent fills the third row in the "Completed consent forms" panel:

```ts
// Upload the signed PDF to Z3 (same pattern as §5)
await oystehr.z3.uploadFile({
  bucketName:    `${env.PROJECT_ID}-consent-forms`,
  'objectPath+': `${patientId}/${dateStamp}-financial-responsibility.pdf`,
  file:          financialConsentPdfBlob,
});

// DocumentReference for the signed PDF
const financialDocRef = await oystehr.fhir.create<DocumentReference>({
  resourceType: 'DocumentReference',
  status:       'current',
  docStatus:    'final',
  type:    { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/document-type', code: 'patient-registration', display: 'Financial responsibility' }] },
  subject: { reference: `Patient/${patientId}` },
  context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
  date:    new Date().toISOString(),
  content: [{ attachment: { contentType: 'application/pdf', url: baseFileUrl, title: 'Financial responsibility consent' } }],
});

// Companion Consent resource
await oystehr.fhir.create<Consent>({
  resourceType: 'Consent',
  status:       'active',
  scope:        { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
  category:     [{ coding: [{ system: 'http://loinc.org', code: '64292-6', display: 'Patient consent' }] }],
  patient:      { reference: `Patient/${patientId}` },
  dateTime:     new Date().toISOString(),
  performer:    [{ reference: `Patient/${patientId}` }],
  policyRule:   { text: 'Financial responsibility' },
  sourceReference: { reference: `DocumentReference/${financialDocRef.id}` },
});
```

#### 7.22.5 Secondary insurance (only for dual-coverage demos)

The Cards & IDs section has a secondary-insurance slot that's empty unless the patient has a second Coverage. For demos where dual-coverage is part of the story (Medicare + supplemental, employer + spouse), synthesize a second Coverage with `order: 2` and upload secondary insurance card images:

```ts
const secondaryCoverage = await oystehr.fhir.create<Coverage>({
  resourceType: 'Coverage',
  status:       'active',
  type:         { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'PPO' }] },
  subscriber:   { reference: `Patient/${patientId}` },
  beneficiary:  { reference: `Patient/${patientId}` },
  subscriberId: 'AETNA-555-44-3322',
  identifier:   [{
    type:   { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MB' }] },
    value:  'AETNA-555-44-3322',
  }],
  payor:        [{ reference: `Organization/${config.secondaryPayer.id}` }],
  order:        2,
});

// Patch the Account to include the secondary coverage
await oystehr.fhir.patch({
  resourceType: 'Account',
  id: accountId,
  operations: [{
    op:    'replace',
    path:  '/coverage',
    value: [
      { coverage: { reference: `Coverage/${coverage.id}` },          priority: 1 },
      { coverage: { reference: `Coverage/${secondaryCoverage.id}` }, priority: 2 },
    ],
  }],
});

// Upload secondary insurance card images via oystehr.z3.uploadFile to <projectId>-insurance-cards
// then create DocumentReference resources tied to the patient (the EHR matches by photo type
// and chronological upload order — secondary card uploads after the primary).
```

Skip unless the demo calls for it; for the standard URI walk-in, single-coverage is the typical scenario.

#### 7.22.6 Quick demo-polish checklist

Before recording a demo, confirm each of these renders populated on the synthesized record:

- [ ] **Cards & IDs**: primary insurance front + back uploaded, photo ID front + back uploaded, "Full insurance card PDF" auto-generates correctly
- [ ] **Booking details**: service category shows "Urgent Care", reason for visit shows the patient's text, no DOB-unmatched warning
- [ ] **Completed consent forms**: 3 rows (HIPAA, Consent to Treat, Financial Responsibility), all marked Signed
- [ ] **CopayWidget**: shows `In-Network` $25 Urgent Care copay (and out-of-network panel populated too) — see §7.20
- [ ] **Appointment notes history**: 1–3 staff/provider annotations
- [ ] **VisitDetailsContainer (progress note)**: Insurance Company name renders (not blank), Subscriber ID renders, Date of Service shows, Provider name shows, Signed On timestamp populated
- [ ] **Allergies / Medications / Medical Conditions / Surgical History / Hospitalization** sections each show 1–2 entries plus the patient's css-note
- [ ] **Vitals**: temperature, HR, BP, SpO2, RR, weight, height all populated
- [ ] **Chief Complaint / HPI / ROS / Exam / MDM / Diagnoses / CPT / E&M / Patient Instructions** all populated by the applied template
- [ ] **Patient Education PDFs** appear inline under Patient Instructions, one per diagnosis
- [ ] **In-house labs**: Strep A negative result with proper status pill
- [ ] **Radiology**: Chest XR shows "Final" status with the report viewer populated (View Images button can be ignored)
- [ ] **In-house medications**: Ibuprofen 400 mg administered with timestamp
- [ ] **Immunizations**: Tdap administered with lot/dose/site
- [ ] **Procedures**: throat-swab Procedures-screen entry with all extensions populated
- [ ] **Disposition**: "Discharge home" + PCP follow-up
- [ ] **Sign-off banner**: Locked appointment, Provenance shows the signing provider's name
- [ ] **Visit note PDF**: appears in the patient's Documents folder shortly after sign-off
- [ ] **Discharge summary PDF**: generates correctly when "Discharge Summary" button is clicked

---

## 8. External-system caveats

Some modules integrate with external systems whose IDs aren't reproducible in synthesized data. Per system:

| External system | Recommendation | Details |
| --- | --- | --- |
| **DoseSpot** (eRx) | **Skip entirely.** | eRx prescriptions require a real DoseSpot prescription ID; Send-to-Pharmacy / refill / cancel all fail without it. Use `MedicationStatement` for medication history (§7.3) and `MedicationAdministration` for in-house dispensing (§7.15). |
| **Stripe** (payments) | **Skip — default to insurance or self-pay-cash.** | Card-on-file requires real Stripe customer + payment method IDs. |
| **AdvaPACS** (radiology) | **Synthesize the order and report; accept that "View Images" is broken.** | Order list, status pill, report viewer, and provider review workflow all derive from FHIR state and work correctly. Only the "View Images" launch button requires a real AdvaPACS account. |
| **External lab connectors** (LabCorp, Quest) | **Use in-house labs (§7.17) instead.** | External labs require a fully-onboarded lab connector; results normally arrive via webhook with real accession numbers. |
| **Eligibility connector** (pVerify, etc.) | **Synthesize the response directly (§7.20).** | The patient-app `get-eligibility` zambda calls a real connector. |
| **Twilio** (SMS) | **Mark Communication.status = completed; no SMS sent.** | Communication resources are stored in the chart but no actual SMS goes out. |
| **Amazon Chime SDK** (telemed video) | Out of scope for in-person synthesis. | |

The recommendation is consistent: **avoid creating fake external IDs**. Design the synthesized visit around the absence of external dependencies.

---

## 9. Orchestration: putting it all together

### 9.1 Phased flow

```
Phase 0  Resolve prerequisite IDs (incl. confirming the template exists)        (§4)
Phase 1  Create the appointment + initial QR                                    (§2.2)
Phase 2  Z3 uploads + DocumentReferences for paperwork                          (§5)
Phase 3a Single save-chart-data call: items templates can't carry              (§7)
         vitals, allergies, medications, conditions, hospitalization, surgical
         history, accident, procedures-screen, disposition, css-note,
         encounter extensions
Phase 3b Apply the template — visit narrative                                  (§6)
         Captures CC, HPI, MOI, ROS, exam, MDM, diagnoses, CPT, E&M, instructions
         in one call. Capture returned resource IDs for cross-references.
Phase 4  Module-specific orders                                                (§§7.15–7.18)
         - In-house meds  (create-update-medication-order)
         - In-house labs  (create-in-house-lab-order + collect + handle-results)
         - Immunizations  (immunization/create-update-order + administer-order)
         - Radiology      (radiology/create-order + save-preliminary-report)
Phase 5  Walk visit-status transitions                                         (§2.3)
         - assign-practitioner before each transition that needs an assignment
         - change-in-person-visit-status per status
Phase 6  Coverage + Eligibility (if insured)                                   (§§7.19, 7.20)
Phase 7  Sign-off                                                              (§3)
```

### 9.2 Sample script structure

```ts
import Oystehr from '@oystehr/sdk';

async function synthesizeVisit(seedName: string) {
  const m2mToken = await mintM2MToken(env);
  const oystehr  = new Oystehr({ accessToken: m2mToken, projectApi: env.PROJECT_API });

  // Phase 0
  const config = await bootstrap(oystehr);

  // Phase 1
  const appt = await oystehr.zambda.execute({
    id: 'create-appointment',
    patient: jane,
    visitType: 'walkin',
    serviceMode: 'in-person',
    serviceCategory: 'urgent-care',
    locationID: config.location.id,
  });
  const { patientId, appointmentId, encounterId, accountId } = appt;

  // Mark Patient with synth identifier for later cleanup / reruns
  await oystehr.fhir.patch({
    resourceType: 'Patient',
    id: patientId,
    operations: [
      { op: 'add', path: '/identifier/-', value: { system: 'https://synth.ottehr.com/patient', value: `${seedName}-patient` } },
    ],
  });

  // Phase 2
  const docs = await uploadAllDocs(oystehr, env, patientId);
  await createDocumentReferences(oystehr, patientId, encounterId, docs);

  // Phase 3a — patient-specific data
  await oystehr.zambda.execute({
    id: 'save-chart-data',
    encounterId,
    vitalsObservations: jane.vitals,
    allergies:          jane.allergies,
    medications:        jane.medications,
    conditions:         jane.pmh,
    episodeOfCare:      jane.hospitalizations,
    surgicalHistory:    jane.surgeries,
    surgicalHistoryNote: jane.surgeryNote,
    notes:              jane.screenNotes,
    reasonForVisit:     jane.reasonForVisit,
    patientInfoConfirmed: { value: true },
    // procedures (Procedures-screen) and disposition come below — they reference
    // template-created Conditions/Procedures by id, so we need to apply the
    // template first to get those ids
  });

  // Phase 3b — apply the visit-narrative template
  const templated = await oystehr.zambda.execute({
    id: 'apply-template',
    encounterId,
    templateName: config.templateName,
    examType:    'inPerson',
  });

  // Capture template-created resource ids for cross-referencing
  const templateIds = await indexTemplateIds(oystehr, encounterId);
  // (e.g., diagnosis Conditions, CPT Procedures — used by procedures-screen
  //  ServiceRequests in §7.10 and reasonReference on in-house meds in §7.15)

  // Phase 3a continued — Procedures-screen + disposition (after template ids are known)
  await oystehr.zambda.execute({
    id: 'save-chart-data',
    encounterId,
    procedures:  jane.proceduresScreen(templateIds),
    disposition: jane.disposition,
  });

  // Phase 4 — module-specific orders
  await orderInHouseMedication(oystehr, patientId, encounterId, config, templateIds);
  await runInHouseLabFlow(oystehr, encounterId, config);
  await administerImmunization(oystehr, encounterId, config);
  await orderRadiology(oystehr, encounterId, config);

  // Phase 5 — assignments + status transitions
  await oystehr.zambda.execute({
    id: 'assign-practitioner',
    encounterId,
    practitionerId: config.intakeStaff.id,
    userRole: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ADM' }],
  });
  for (const updatedStatus of ['ready', 'intake', 'ready for provider'] as const) {
    await oystehr.zambda.execute({ id: 'change-in-person-visit-status', encounterId, updatedStatus });
  }
  await oystehr.zambda.execute({
    id: 'assign-practitioner',
    encounterId,
    practitionerId: config.provider.id,
    userRole: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }],
  });
  for (const updatedStatus of ['provider', 'discharged', 'completed'] as const) {
    await oystehr.zambda.execute({ id: 'change-in-person-visit-status', encounterId, updatedStatus });
  }

  // Phase 6 — insurance + eligibility
  const coverage = await createCoverageAndAccountLink(oystehr, patientId, accountId, config);
  await createEligibilityResources(oystehr, patientId, coverage.id, config);

  // Phase 7 — sign-off
  await oystehr.zambda.execute({ id: 'sign-appointment', appointmentId, encounterId });

  console.log(`Synthesized visit ${encounterId} for patient ${patientId}`);
  return { patientId, appointmentId, encounterId };
}
```

### 9.3 Phase 3a / 3b ordering

Notice that **`apply-template` runs between two halves of the patient-specific data**:

1. The first `save-chart-data` writes data the template doesn't reference (vitals, allergies, history, css-note).
2. `apply-template` writes the visit narrative — including diagnoses and CPT Procedures whose ids are needed downstream.
3. The second `save-chart-data` (and Phase 4 module orders) cross-reference template-created resources by id (e.g. `procedures[].diagnoses` references the diagnosis Conditions the template created; in-house med `reasonReference` points at a template-created diagnosis).

If your visit synthesis doesn't need cross-references between non-template chart data and template chart data, you can collapse Phases 3a and 3b into back-to-back calls without splitting the `save-chart-data` payload.

### 9.4 Idempotent reruns

For repeatable seeding:

1. On startup, look up the Patient by synth identifier:

   ```ts
   const existing = await oystehr.fhir.search<Patient>({
     resourceType: 'Patient',
     params: [{ name: 'identifier', value: `https://synth.ottehr.com/patient|${seedName}-patient` }],
   });
   ```

2. If found, capture the existing `Patient.id` and the prior Encounter id (search by `subject` + filter to the synth seed); skip Phase 1.

3. Re-call `apply-template` — it cleanly replaces the templated modules without duplicating.

4. For non-template chart data, supply each row's prior `resourceId` to `save-chart-data` to update rather than create duplicates. Capture each id from the first run's response.

5. For module orders (in-house meds, immunizations, in-house labs, radiology), call the relevant `delete-` zambda first if you want a clean rebuild, or call the create-update variant with the prior order id to update.

### 9.5 Cleaning up a synthesized visit

```ts
async function cleanup(oystehr: Oystehr, seedName: string) {
  const patient = (await oystehr.fhir.search<Patient>({
    resourceType: 'Patient',
    params: [{ name: 'identifier', value: `https://synth.ottehr.com/patient|${seedName}-patient` }],
  })).unbundle()[0];
  if (!patient) return;
  const patientId = patient.id!;

  const encounters = (await oystehr.fhir.search<Encounter>({
    resourceType: 'Encounter',
    params: [{ name: 'subject', value: `Patient/${patientId}` }],
  })).unbundle();

  for (const enc of encounters) {
    const inHouseOrders = await oystehr.zambda.execute({ id: 'get-in-house-orders', encounterId: enc.id });
    for (const order of inHouseOrders) {
      await oystehr.zambda.execute({ id: 'delete-in-house-lab-order', orderId: order.id });
    }
    // similarly: get-medication-orders → delete; immunization/get-orders → cancel; radiology/order-list → cancel
  }

  // Cascading FHIR deletes
  const types = [
    'Provenance', 'Task', 'DocumentReference', 'Communication', 'Observation',
    'Condition', 'Procedure', 'ServiceRequest', 'DiagnosticReport', 'Specimen',
    'MedicationAdministration', 'MedicationStatement', 'AllergyIntolerance',
    'EpisodeOfCare', 'ClinicalImpression', 'Immunization',
    'CoverageEligibilityRequest', 'CoverageEligibilityResponse',
    'Encounter', 'Appointment', 'Slot', 'Coverage', 'Account', 'RelatedPerson',
    'QuestionnaireResponse', 'Patient',
  ];
  for (const type of types) {
    const resources = (await oystehr.fhir.search({ resourceType: type, params: [{ name: 'subject', value: `Patient/${patientId}` }] })).unbundle();
    await Promise.all(resources.map(r => oystehr.fhir.delete({ resourceType: type, id: r.id! })));
  }

  // Z3 cleanup
  for (const bucket of ALL_BUCKETS) {
    const objects = await oystehr.z3.listObjects({ bucketName: `${env.PROJECT_ID}-${bucket}`, 'objectPath+': `${patientId}/` });
    for (const obj of objects.results || []) {
      await oystehr.z3.deleteObject({ bucketName: `${env.PROJECT_ID}-${bucket}`, 'objectPath+': obj.objectPath });
    }
  }
}
```

---

## Appendix A — Zambda quick reference

| Zambda id | Purpose |
| --- | --- |
| `create-appointment` | Create Patient + Account + Slot + Appointment + Encounter + initial QR (§2.2) |
| `apply-template` | Apply a global template to an encounter (§6.2) |
| `admin-create-template` | Snapshot a fully-charted encounter into a new template (§6.3) |
| `admin-get-template-detail` | Fetch a template's full contained-resource list |
| `admin-rename-template` | Rename a template |
| `admin-delete-template` | Delete a template |
| `list-templates` | List templates for an exam type |
| `save-chart-data` | Populate non-template chart fields (§7.1) |
| `delete-chart-data` | Remove chart-data rows |
| `change-in-person-visit-status` | Visit-status transitions (§2.3) |
| `assign-practitioner` | Assign admitter / attender (§2.4) |
| `sign-appointment` | Sign and lock the visit (§3.2) |
| `create-update-medication-order` | In-house medication order + administer (§7.15) |
| `get-medication-orders` | List in-house medication orders for an encounter |
| `create-in-house-lab-order` | In-house lab order (§7.17) |
| `collect-in-house-lab-specimen` | Specimen collection (§7.17) |
| `handle-in-house-lab-results` | Record results (§7.17) |
| `delete-in-house-lab-order` | Cleanup |
| `get-create-in-house-lab-order-resources` | Catalog lookup |
| `get-in-house-orders` | List orders |
| `radiology/create-order` | Radiology order (§7.18) |
| `radiology/save-preliminary-report` | Preliminary DiagnosticReport (§7.18) |
| `radiology/send-for-final-read` | Mark ready for radiologist (§7.18) |
| `radiology/order-list` | List orders |
| `radiology/cancel-order` | Cancel |
| `immunization/create-update-order` | Vaccine order (§7.16) |
| `immunization/administer-order` | Vaccine administration (§7.16) |
| `immunization/get-orders` | List |
| `immunization/cancel-order` | Cancel |
| `create-upload-document-url` | Mint a Z3 presigned URL (alternative to `oystehr.z3.uploadFile`) |
| `delete-patient-document` | Delete a Z3-backed DocumentReference |

For the canonical, complete list of registered zambdas in your project, see `config/oystehr/zambdas.json`.

---

## Appendix B — SDK methods used

| Method | Purpose |
| --- | --- |
| `new Oystehr({ accessToken, projectApi })` | Construct the SDK client |
| `oystehr.zambda.execute({ id, ...body })` | Invoke a zambda by name |
| `oystehr.fhir.search<T>({ resourceType, params })` | FHIR search |
| `oystehr.fhir.get<T>({ resourceType, id })` | Read one resource by id |
| `oystehr.fhir.create<T>(resource)` | Create a resource |
| `oystehr.fhir.update<T>(resource)` | Update a resource (must include id) |
| `oystehr.fhir.patch<T>({ resourceType, id, operations })` | JSON Patch a resource |
| `oystehr.fhir.transaction({ requests })` | Atomic batch (all-or-nothing) |
| `oystehr.fhir.batch({ requests })` | Non-atomic batch |
| `oystehr.fhir.delete({ resourceType, id })` | Delete a resource |
| `oystehr.z3.uploadFile({ bucketName, 'objectPath+', file })` | Upload a file to Z3 |
| `oystehr.z3.downloadFile({ bucketName, 'objectPath+' })` | Download a file from Z3 |
| `oystehr.z3.listObjects({ bucketName, 'objectPath+' })` | List Z3 objects under a prefix |
| `oystehr.z3.deleteObject({ bucketName, 'objectPath+' })` | Delete a Z3 object |
| `oystehr.user.invite({ email, ... })` | Invite a user via Oystehr IAM |

The SDK package: `@oystehr/sdk`. Construct one client per script run with the M2M access token; reuse across all calls.

---

## Appendix C — Local environment swap

To run the local apps (`packages/zambdas` on :3000, `apps/intake` on :3002, `apps/ehr` on :4002) against a different Oystehr project — e.g. to point them at a "synth" project for synthesis testing while leaving your day-to-day local project's data untouched — the repo already has a built-in mechanism via the `ENV` shell variable. This appendix documents it.

### Files involved (per environment)

For an environment named `<env>` (e.g. `local`, `demo`, `staging`, `synth`), three files together fully describe the environment:

| File | Purpose | Gitignored |
| --- | --- | --- |
| `packages/zambdas/.env/zambda-secrets-<env>.json` | Zambda runtime secrets — Auth0 M2M creds, FHIR/Project API URLs, third-party service keys (SendGrid, Stripe, Candid, Anthropic, AdvAPACs, Google Cloud, …), feature flags. The `PROJECT_ID` here binds zambdas to a specific Oystehr project. | ✅ (`packages/zambdas/.gitignore`: `.env/*`) |
| `apps/ehr/env/.env.<env>` | EHR app's Vite env — `VITE_APP_PROJECT_ID`, `VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID` (for user login via the EHR's Oystehr Application), `VITE_APP_FHIR_API_URL`, feature flags. | ✅ (`apps/ehr/.gitignore`: `env/*`) |
| `apps/intake/env/.env.<env>` | Intake (patient portal) Vite env — `VITE_APP_PROJECT_ID`, `VITE_APP_CLIENT_ID` (for patient login via the intake's Application), feature flags. | ✅ (`apps/intake/.gitignore`: `env/*`) |

### How the `ENV` variable selects them

- **Zambdas**: `packages/zambdas/package.json`'s `start:iac` is `tsx watch ... -- secrets=.env/zambda-secrets-${ENV:-local}.json`. The local-server reads that secrets file at boot.
- **EHR**: `apps/ehr/package.json`'s `start:iac` is `vite --mode $([ "$ENV" = "local" ] && echo default || echo ${ENV:-default})`. Vite then loads `apps/ehr/env/.env.<mode>`. Note the special-case: `ENV=local` resolves to mode `default`, but the EHR's actual config still comes from `.env.local` because Vite always loads the most-specific `.env.*` file; only the `.env.<mode>` resolution differs. For non-local environments, `ENV=demo` → mode `demo` → loads `.env.demo` (and any `.env` defaults).
- **Intake**: same pattern as EHR.

The combined effect: setting `ENV=<env>` at startup tells all three apps to load the corresponding env file from their respective env directories.

### Adding a new environment (one-time setup)

Replace `<env>` and `<project-id>` with your values. M2M creds come from the Oystehr console for the target project (IAM → M2M Clients), Application client IDs from the project's Applications list.

1. **Zambdas secrets file** — copy from a known-good env and patch:
   ```bash
   cp packages/zambdas/.env/zambda-secrets-local.json \
      packages/zambdas/.env/zambda-secrets-<env>.json
   # Then edit and set PROJECT_ID, AUTH0_CLIENT, AUTH0_SECRET, ENVIRONMENT, project-name
   ```

2. **EHR Vite env** — copy and patch:
   ```bash
   cp apps/ehr/env/.env.local apps/ehr/env/.env.<env>
   # Then edit and set VITE_APP_PROJECT_ID, VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID, VITE_APP_ENV
   ```

3. **Intake Vite env** — copy and patch:
   ```bash
   cp apps/intake/env/.env.local apps/intake/env/.env.<env>
   # Then edit and set VITE_APP_PROJECT_ID, VITE_APP_CLIENT_ID, VITE_APP_ENV
   ```

All three files are gitignored — no risk of committing credentials.

### Running with a non-default environment

Stop any running stack first (kill the running zambdas, intake, EHR processes). Then:

```bash
# Run against environment <env>:
ENV=<env> npm run apps:start:no-apply

# Or for individual services:
ENV=<env> npm run zambdas:start
ENV=<env> npm run ehr:start
ENV=<env> npm run intake:start
```

The `:no-apply` variant skips the `terraform apply-local` step, which is appropriate when you're not deploying IaC changes — only swapping the runtime project.

### Reverting

```bash
# Stop:
# (kill the three running processes — find PIDs with: lsof -i :3000 -i :3002 -i :4002 -P -n)

# Start back on local (the default — ENV does not need to be set):
npm run apps:start:no-apply
```

### Caveats

- **User accounts are per-project.** The provider account you use to log into the EHR on your default project won't work after swapping to a different project. You need a user provisioned on the target project (Oystehr console → IAM → Users) with appropriate roles.
- **Browser session.** Your existing browser tab on `localhost:4002` will hold a stale token from the previous project. Either log out + back in, or open in an incognito/private window.
- **Intake patient login.** For full patient-facing flows on the new project, intake's `VITE_APP_CLIENT_ID` must be the target project's intake Application client ID. Synthesis tests typically don't need patient login (we synthesize via the API directly), so this is acceptable to leave stale during synthesis-only testing — but expect intake patient flows to fail until updated.
- **Third-party services.** SendGrid, Stripe, Candid, AdvAPACs, etc. credentials in the secrets file may be project-specific or environment-specific in real deployments. For local synthesis testing, leaving the source environment's third-party creds in place is usually fine since most synthesis paths don't invoke them.
