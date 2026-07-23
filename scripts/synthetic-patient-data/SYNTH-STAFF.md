# Synthetic staff (providers, MAs, front desk) as EHR employees

This sets up a roster of fake-but-realistic **staff** in an Oystehr project so they show up
in the EHR exactly like real employees — **Admin → Employees**, the **provider assignment
dropdown**, attribution on visits — **but cannot log in**. Use it to make synthetic visit
data (created by the `synthesize-visit.ts` harness) look like it was handled by real people.

Two scripts:

| Script | What it does | Who runs it |
|---|---|---|
| `link-synth-staff-users.ts` | Creates the 24 staff as **EHR users** (Practitioner + IAM user + role) | **You** — it creates accounts, so run it yourself (the `!` prefix is fine) |
| `fix-synth-staff-qualifications.ts` | One-off repair of provider license shape (see gotcha below) | Anyone — FHIR-only edit, no account creation |

## Data model — how a person becomes an "employee"

In Ottehr, **Employees = IAM users whose profile is a Practitioner** (`oystehr.user.list()`,
filtered to Practitioner profiles by the `get-employees` zambda). They are **not** plain FHIR
resources. So to appear in the roster, each person needs:

1. A **Practitioner** FHIR resource (the profile).
2. An **IAM user** linked to that Practitioner.
3. A **role** (`Provider` for clinicians, `Staff` for everyone else).

`oystehr.user.invite()` creates all three at once. It **requires** a `resource` (the
Practitioner) — you cannot invite a user and point it at a pre-existing Practitioner via
`profile` alone (you get `resource is required`). So the Practitioner is born as part of the
invite.

**Login is blocked** by giving every account a reserved, non-deliverable email
(`<first>.<last>@synth.invalid` — RFC 2606 `.invalid`). The account looks normal but no mail
server can deliver the set-password / magic-link, so it can't be signed into.

### Roles

The synth project's roles are: `Administrator, Customer Support, Inactive, Manager, Patient,
Prescriber, Provider, Staff`. **There is no "Front Desk" role** — front-desk and MA staff map
to the generic `Staff` role. Front-desk/MA attribution on a *visit* comes from the appointment
`created-by` tag, not from a distinct role.

```
provider          → Provider role
medical-assistant → Staff role
front-desk        → Staff role
```

### Marker tags (so the population orchestrator can find them)

Every synthetic Practitioner carries `meta.tag`:

- `https://fhir.ottehr.com/sid/synth-staff` = `synth-staff`  (find them all by `_tag`)
- `https://fhir.ottehr.com/sid/synth-staff-role` = `provider | medical-assistant | front-desk`
- `https://fhir.ottehr.com/sid/synth-staff-location` = `Los Angeles | New York`

…plus an `identifier` on `https://fhir.ottehr.com/sid/synth-staff-id` = `<first>-<last>-<role>`.

### The roster (24 people)

12 providers (6 LA, 6 NY), 6 MAs (3/3), 6 front desk (3/3). Providers carry a credential
(MD/DO/NP/PA) rendered as a state license. Edit the `STAFF` array in
`link-synth-staff-users.ts` to change it.

## ⚠️ Gotcha: provider `qualification` MUST be a full license shape

The EHR's `get-user` zambda (powers the **employee detail page**) treats **every**
`Practitioner.qualification` as a state license and reads, with no guards:

```ts
qualification.extension[0].extension[1].valueCodeableConcept.coding[0].code  // state
qualification.code.coding[0].code                                            // credential
qualification.extension[0].extension[0].valueCode                            // active?
```

A bare `qualification: [{ code: { coding: [{ code: 'MD' }] } }]` (no `extension`) makes
`qualification.extension[0]` throw a **TypeError**, which surfaces as a **500
`Failed to get User: {}`** — the list page works, but the detail page won't load.

So a provider's qualification must match `makeQualificationForPractitioner`
(`packages/utils/lib/fhir/practitioners.ts`):

```ts
{
  code: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7', code: 'MD' }],
          text: 'Qualification code' },
  extension: [{
    url: 'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification',
    extension: [
      { url: 'status', valueCode: 'active' },
      { url: 'whereValid',
        valueCodeableConcept: { coding: [{ code: 'CA',
          system: 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state' }] } },
    ],
  }],
}
```

State is derived from location: **Los Angeles → CA**, **New York → NY**. Valid credential
codes (`PractitionerQualificationCode`): MD, DO, NP, PA, etc. MAs/front-desk get **no**
qualification (correct — an employee with no licenses is valid, `licenses: []`).

`link-synth-staff-users.ts` already emits the correct shape. `fix-synth-staff-qualifications.ts`
exists to repair Practitioners created before the fix.

## Recreate in another environment

Prereqs: M2M credentials for the target project at `packages/zambdas/.env/<env>.json`
(providing `AUTH0_ENDPOINT`, `AUTH0_CLIENT`, `AUTH0_SECRET`, `AUTH0_AUDIENCE`, `PROJECT_ID`,
`PROJECT_API`). The target project must have a `Provider` and `Staff` role.

```bash
# 1. Create the 24 staff as non-loginable EHR users (creates accounts — run it yourself).
#    Auto-detects the EHR application; override with APPLICATION_ID=<id> if needed.
npx env-cmd -f packages/zambdas/.env/synth.json \
  npx tsx scripts/synthetic-patient-data/link-synth-staff-users.ts

# 2. (Only if any provider was created with the old bare-qualification shape) repair licenses.
npx env-cmd -f packages/zambdas/.env/synth.json \
  npx tsx scripts/synthetic-patient-data/fix-synth-staff-qualifications.ts
```

Both scripts are **idempotent**: `link` skips any username that already exists; `fix` skips
qualifications that already have an extension.

Verify: in the EHR, **Admin → Employees** lists all 24, providers show the `Provider` role,
and each detail page loads (showing an active state license for providers). The provider
assignment dropdown on a visit shows the 12 providers.
