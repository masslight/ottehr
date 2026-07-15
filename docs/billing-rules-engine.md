<!-- GENERATED FILE — DO NOT EDIT.
     This document is rendered from the rules-engine field catalog and schemas in
     packages/utils/lib/types/data/billing/. To update it, change those sources and run
     `npm run docs:billing-rules`. A unit test fails when this file is out of date. -->

# Billing pre-submission rules engine

The rules engine runs after a claim is created (and on demand), before the claim is submitted to the
payer. Rules run top to bottom; each rule is an **if / else-if / else** conditional whose branches
end in a list of **actions**. When every rule has run without holding the claim, the claim is
submitted.

- A rule that applies the **Hold** tag stops the engine and holds the claim from
  submission for manual review.
- An action that cannot be applied (for example, setting a property whose target is missing from the
  claim) fails the rule: the engine stops, applies the **Hold** tag, and never submits a
  claim with a silently skipped change.
- Disabled rules are skipped.

This reference lists every supported condition property, operator, and action. It is generated from
the same catalog that drives the rule builder and the engine, so it always matches what the engine
actually supports (68 properties, 55 of them settable).

## Conditions

A condition is one of:

- **All claims** — always matches; useful for a rule that should apply unconditionally.
- **Claim property** — compares one claim property (below) against a value using an operator.
- **Group (AND / OR)** — combines nested conditions with *all of* (AND) or *any of* (OR) logic.
  Groups can nest.

### Operators

Which operators a property supports depends on its type (see the property tables).

| Operator | Reads as | Value | Description |
| --- | --- | --- | --- |
| `eq` | equals | single value | The property exactly equals the value. |
| `neq` | does not equal | single value | The property does not exactly equal the value. |
| `in` | is one of | list of values | The property equals one of the listed values. |
| `notIn` | is not one of | list of values | The property equals none of the listed values. |
| `gt` | is greater than / is after (dates) | single value | The property is greater than the value (numerically for amounts, chronologically for dates). |
| `gte` | is at least / is on or after (dates) | single value | The property is greater than or equal to the value. |
| `lt` | is less than / is before (dates) | single value | The property is less than the value (numerically for amounts, chronologically for dates). |
| `lte` | is at most / is on or before (dates) | single value | The property is less than or equal to the value. |
| `contains` | contains | single value | A text property contains the value as a substring; a list property includes the value as an entry. |
| `notContains` | does not contain | single value | The negation of "contains". |
| `exists` | is present | none | The property has a (non-empty) value on the claim. |
| `notExists` | is empty | none | The property is missing or empty on the claim. |

## Claim properties

### Claim

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Payer ID | `payerId` | payer ID | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The primary payer's ID. Setting it re-points the primary coverage's payer and the claim's insurer. |
| Claim type | `type` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim type (professional or institutional). Allowed values: `professional` (Professional), `institutional` (Institutional). |
| Service category | `service` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The service category code on the claim (e.g. urgent-care, workers-comp). Categories are configurable, so the value is free text. |
| Service date | `serviceDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The date of service (read from the first service line). Setting it applies the one date to every service line, matching the claim editor. |
| Created date | `created` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | no | The date the claim was created. Read-only. |
| Billing type | `billingType` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | no | Whether the claim bills insurance or the patient. Derived from whether the claim carries a real coverage, so it is read-only (attach or remove a coverage to change it). Allowed values: `Insurance Pay`, `Self Pay`. |
| Billable status | `billableStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | no | Whether the claim is billable. Derived from the claim's lifecycle status (entered-in-error claims are not billable), so it is read-only. Allowed values: `Billable`, `Not Billable`. |
| Encounter ID | `encounterId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | no | The clinical encounter this claim was generated from. Read-only. |
| Appointment ID | `appointmentId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | no | The clinical appointment this claim was generated from. Read-only. |
| Billed amount | `billed` | number | equals, does not equal, is greater than, is at least, is less than, is at most, is present, is empty | no | The claim total in dollars. Derived from the sum of service line charges, so it is read-only — it is recomputed when a rule updates line charges or removes lines. |
| Diagnosis codes | `diagnosisCodes` | list of codes | contains, does not contain, is present, is empty | no | The list of ICD-10 diagnosis codes on the claim. Use contains / does-not-contain to test for a code; read-only (rules cannot restructure the diagnosis list). |
| Procedure (CPT) codes | `cptCodes` | list of codes | contains, does not contain, is present, is empty | no | The list of CPT/HCPCS codes across the service lines. Use contains / does-not-contain to test for a code; change codes with the "Update service lines" action. |
| Duplicate CPT codes | `duplicateCptCodes` | list of codes | contains, does not contain, is present, is empty | no | The CPT/HCPCS codes that appear on more than one service line (empty when every line has a distinct code). "Is present" detects any duplicate billing; "contains" detects duplicates of a specific code. |
| Place of service codes | `placeOfServiceCodes` | list of codes | contains, does not contain, is present, is empty | no | The list of CMS place-of-service codes across the service lines. Change per-line codes with the "Update service lines" action; the service facility place of service applies to future claims. |
| Service line count | `serviceLineCount` | number | equals, does not equal, is greater than, is at least, is less than, is at most | no | The number of service lines on the claim (0 when there are none). |

### Claim status

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| AR Stage | `status.arStage` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's AR Stage indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `insurance-payer-ar` (Insurance Payer AR), `patient-ar` (Patient AR), `non-insurance-payer-ar` (Non-insurance Payer AR). |
| Insurance AR Status | `status.insuranceArStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's Insurance AR Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `created` (Created), `submitted` (Submitted), `adjudicated` (Adjudicated), `finalized` (Finalized). |
| Insurance Paid Status | `status.insurancePaidStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's Insurance Paid Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `unpaid` (Unpaid), `partially-paid` (Partially paid), `fully-paid` (Fully paid). |
| Adjudication Status | `status.adjudicationStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's Adjudication Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `approved` (Approved), `rejected` (Rejected), `denied` (Denied). |
| Patient AR Status | `status.patientArStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's Patient AR Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `not-invoiced` (Not invoiced), `ready-to-invoice` (Ready to invoice), `invoiced` (Invoiced), `finalized` (Finalized). |
| Patient Paid Status | `status.patientPaidStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's Patient Paid Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `unpaid` (Unpaid), `partially-paid` (Partially paid), `fully-paid` (Fully paid). |
| Non-insurance AR Status | `status.nonInsuranceArStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's Non-insurance AR Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `created` (Created), `invoiced` (Invoiced), `finalized` (Finalized). |
| Non-insurance Paid Status | `status.nonInsurancePaidStatus` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The claim's Non-insurance Paid Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `unpaid` (Unpaid), `partially-paid` (Partially paid), `fully-paid` (Fully paid). |

### Patient

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| First name | `patient.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The patient's first (given) name. |
| Middle name | `patient.middleName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The patient's middle name (second given name). |
| Last name | `patient.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The patient's last (family) name. |
| Date of birth | `patient.birthDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The patient's date of birth (YYYY-MM-DD). |
| Gender | `patient.gender` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The patient's administrative gender. Allowed values: `male` (Male), `female` (Female), `other` (Other), `unknown` (Unknown). |
| Address line 1 | `patient.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The first street line of the patient's address. |
| Address line 2 | `patient.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The second street line of the patient's address. |
| City | `patient.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The city of the patient's address. |
| State | `patient.state` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The state of the patient's address (two-letter code, e.g. CA). |
| ZIP code | `patient.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The postal code of the patient's address. |

### Primary insurance

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Member ID | `insurance.memberId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The primary coverage's member/subscriber ID. |
| Coverage status | `insurance.status` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The primary coverage's status. Allowed values: `active` (Active), `cancelled` (Cancelled), `draft` (Draft), `entered-in-error` (Entered in error). |
| Plan type | `insurance.planType` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The primary coverage's plan type (X12 insurance type code). Allowed values: `09` (09 - Self Pay), `11` (11 - Other Non-Federal Programs), `12` (12 - PPO), `13` (13 - POS), `14` (14 - EPO), `15` (15 - Indemnity Insurance), `16` (16 - HMO Medicare Risk), `17` (17 - DMO), `AM` (AM - Auto), `BL` (BL - BlueCross BlueShield), `CH` (CH - Champus), `CI` (CI - Commercial Insurance Co), `DS` (DS - Disability), `FI` (FI - Federal Employees), `HM` (HM - HMO), `LM` (LM - Liability), `MA` (MA - Medicare Part A), `MB` (MB - Medicare Part B), `MC` (MC - Medicaid), `OF` (OF - Other Federal Program), `TV` (TV - Title V), `VA` (VA - Veterans Affairs Plan), `WC` (WC - Workers Comp Health Claim), `ZZ` (ZZ - Mutually Defined). |
| Relationship to subscriber | `insurance.relationship` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | no | The patient's relationship to the primary policy holder. Read-only: changing it restructures the policy-holder record, which rules cannot do — edit the claim's insurance instead. Allowed values: `Self`, `Child`, `Parent`, `Spouse`, `Common Law Spouse`, `Injured Party`, `Other`. |

### Policy holder

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| First name | `policyHolder.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The primary policy holder's first (given) name. |
| Middle name | `policyHolder.middleName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The primary policy holder's middle name (second given name). |
| Last name | `policyHolder.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The primary policy holder's last (family) name. |
| Date of birth | `policyHolder.birthDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The primary policy holder's date of birth (YYYY-MM-DD). |
| Gender | `policyHolder.gender` | one of the listed values | equals, does not equal, is one of, is not one of, is present, is empty | yes | The primary policy holder's administrative gender. Allowed values: `male` (Male), `female` (Female), `other` (Other), `unknown` (Unknown). |
| Address line 1 | `policyHolder.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The first street line of the primary policy holder's address. |
| Address line 2 | `policyHolder.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The second street line of the primary policy holder's address. |
| City | `policyHolder.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The city of the primary policy holder's address. |
| State | `policyHolder.state` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The state of the primary policy holder's address (two-letter code, e.g. CA). |
| ZIP code | `policyHolder.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The postal code of the primary policy holder's address. |

### Secondary insurance

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Secondary payer ID | `secondaryInsurance.payerId` | payer ID | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The secondary payer's ID. Setting it re-points the secondary coverage's payer. |
| Secondary member ID | `secondaryInsurance.memberId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The secondary coverage's member/subscriber ID. |

### Rendering provider

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| NPI | `renderingProvider.npi` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The rendering provider's NPI. |
| First name | `renderingProvider.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The rendering provider's first name (individual providers only; setting it on an organization provider fails the rule). |
| Last name / organization name | `renderingProvider.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The rendering provider's last name, or the organization name for organization providers. |
| Taxonomy code | `renderingProvider.taxonomy` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The rendering provider's taxonomy code. |

### Billing provider

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| NPI | `billingProvider.npi` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The billing provider's NPI. |
| First name | `billingProvider.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The billing provider's first name (individual providers only; setting it on an organization provider fails the rule). |
| Last name / organization name | `billingProvider.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The billing provider's last name, or the organization name for organization providers. |
| Taxonomy code | `billingProvider.taxonomy` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The billing provider's taxonomy code. |
| Tax ID (TIN) | `billingProvider.taxId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The billing provider's tax ID (TIN). |

### Service facility

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Facility name | `serviceFacility.name` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The service facility's name. |
| Facility NPI | `serviceFacility.npi` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The service facility's NPI. |
| CLIA number | `serviceFacility.clia` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The service facility's CLIA number. |
| Place of service code | `serviceFacility.posCode` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The service facility's CMS place-of-service code (e.g. 11 for office, 20 for urgent care). |
| Address line 1 | `serviceFacility.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The first street line of the service facility's address. |
| Address line 2 | `serviceFacility.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The second street line of the service facility's address. |
| City | `serviceFacility.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The city of the service facility's address. |
| State | `serviceFacility.state` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The state of the service facility's address (two-letter code, e.g. CA). |
| ZIP code | `serviceFacility.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The postal code of the service facility's address. |

### Tags

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Claim tags | `tags` | list of codes | contains, does not contain, is present, is empty | no | The list of tags on the claim. Use contains / does-not-contain to test for a tag; add tags with the "Apply a tag" action. |

## Service line properties

Service lines are an array, so their per-line properties are not claim properties: they are matched
and changed by the **Update service lines** / **Remove service lines** actions below, each of which
carries its own line predicate — either *all service lines* or *lines matching a property*
comparison (one property, operator, and value per predicate). A rule's condition can detect that a
matching line exists (e.g. `cptCodes` *contains* X, `duplicateCptCodes` *is present*,
`serviceLineCount` *is greater than* N); the action's own match is what binds *which* lines it
touches.

| Property | ID | Type | Match operators | Updatable | Description |
| --- | --- | --- | --- | --- | --- |
| CPT code | `cptCode` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The line's CPT/HCPCS procedure code. Setting it replaces the line's procedure coding. |
| Modifiers | `modifiers` | list of codes | contains, does not contain, is present, is empty | yes | The line's procedure modifiers. When updating, the operation chooses how the value applies: "set" replaces the whole list (comma-separated; empty clears it), "add" appends one modifier, "remove" drops one. |
| Units | `units` | number | equals, does not equal, is greater than, is at least, is less than, is at most, is present, is empty | yes | The line's unit count. Setting it requires a positive number. |
| Charges | `charges` | number | equals, does not equal, is greater than, is at least, is less than, is at most, is present, is empty | yes | The line's charge amount in dollars. Setting it requires a non-negative number; the claim's billed total is recomputed. |
| Place of service code | `placeOfService` | text | equals, does not equal, is one of, is not one of, contains, does not contain, is present, is empty | yes | The line's CMS place-of-service code. Setting an empty value clears it. |
| Service date | `serviceDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The line's date of service (YYYY-MM-DD). |

## Actions

A matched branch's outcome is a list of actions, applied in order:

| Action | Description |
| --- | --- |
| Set a property (`setField`) | Sets one of the settable claim properties above to a new value. Setting an empty value clears the property. The change is written to the claim's working-copy resources and recorded in the claim history, attributed to the rules engine. If the property cannot be set (unknown or read-only property, invalid value, or the target resource is missing from the claim), the rule fails and the claim is held. |
| Apply a tag (`applyTag`) | Adds a tag to the claim (no-op if the claim already carries it). Applying the **Hold** tag holds the claim: the engine stops and the claim is not submitted. |
| Update service lines (`updateServiceLines`) | Applies one change (an updatable service line property + value; for modifiers, a set/add/remove operation) to every line matching the action's line predicate. Zero matching lines is a no-op, not a failure — pair the action with a condition when a match must exist. An invalid value or an operation that doesn't apply to the property fails the rule and holds the claim. Changing charges recomputes the claim's billed total. |
| Remove service lines (`removeServiceLines`) | Removes every line matching the action's line predicate (all lines when the predicate is "all service lines"). Surviving lines are re-sequenced and the claim's billed total is recomputed. Zero matching lines is a no-op. |
| Do nothing (`noop`) | Explicitly does nothing. Useful as an else branch that intentionally takes no action. |

Actions after a failed action or after the **Hold** tag do not run.
