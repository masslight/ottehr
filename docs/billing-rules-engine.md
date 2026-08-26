<!-- GENERATED FILE — DO NOT EDIT.
     This document is rendered from the billing rules field catalog and schemas in
     packages/utils/lib/types/data/billing/. To update it, change those sources and run
     `npm run docs:billing-rules`. A unit test fails when this file is out of date. -->

# Billing rules

The billing app runs several independent sets of rules. Each set has its own ordered rules, its own
automatic trigger, and its own on-success effect:

| Rules | Run automatically | When every rule passes |
| --- | --- | --- |
| Claim Submission Rules (`claim-submission`) | when an Insurance Payer AR claim is submitted | the claim is submitted to the payer |
| Non-Insurance Payer Pre-Invoice Rules (`non-insurance-payer-pre-invoice`) | when a claim is created in Non-insurance Payer AR | the Non-insurance AR Status moves to Ready to invoice |
| Patient AR Pre-Invoice Rules (`patient-ar-pre-invoice`) | when a self-pay claim is created in Patient AR | the Patient AR Status moves to Ready to invoice |

Each set of rules runs automatically only when a claim is created in its AR stage, and on demand
from the claim detail page. All of the sets share the same rule shape and the semantics below —
everything in this reference applies to each of them.

Rules run top to bottom; each rule is an **if / else-if / else** conditional whose branches end in a
list of **actions**. When every rule has run without holding the claim, the on-success effect above
is performed.

- A rule that applies the **Hold** tag stops the run and holds the claim for manual
  review; the on-success effect does not happen.
- An action that cannot be applied (for example, setting a property whose target is missing from the
  claim) fails the rule: the run stops, the **Hold** tag is applied, and the claim never
  proceeds with a silently skipped change.
- Disabled rules are skipped.

This reference lists every supported condition property, operator, and action. It is generated from
the same catalog that drives the rule builder and the rule runs, so it always matches what the rules
actually support (116 properties, 103 of them settable).

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
| `eq` | equals | single value | The property exactly equals the value. Number-typed properties compare numerically, so 100 matches 100.00. |
| `neq` | does not equal | single value | The property does not exactly equal the value. |
| `in` | is one of | list of values | The property equals one of the listed values. |
| `notIn` | is not one of | list of values | The property equals none of the listed values. |
| `gt` | is greater than / is after (dates) | single value | The property is greater than the value (numerically for amounts, chronologically for dates). |
| `gte` | is at least / is on or after (dates) | single value | The property is greater than or equal to the value. |
| `lt` | is less than / is before (dates) | single value | The property is less than the value (numerically for amounts, chronologically for dates). |
| `lte` | is at most / is on or before (dates) | single value | The property is less than or equal to the value. |
| `contains` | contains | single value | A text property contains the value as a substring; a list property includes the value as an entry. |
| `notContains` | does not contain | single value | The negation of "contains". |
| `startsWith` | starts with | single value | A text property begins with the value (e.g. member ID starts with XKD). |
| `notStartsWith` | does not start with | single value | The negation of "starts with". |
| `matches` | matches pattern | single value | A text property matches the regular expression; a list property matches when any entry does. Standard (unanchored) semantics: the pattern can match anywhere in the value — anchor with ^ and $ to match the whole value, e.g. ^9938[1-7]$ matches exactly CPT codes 99381 through 99387. |
| `notMatches` | does not match pattern | single value | The negation of "matches pattern": a text property does not match the regular expression; a list property matches when no entry does. |
| `exists` | is present | none | The property has a (non-empty) value on the claim. |
| `notExists` | is empty | none | The property is missing or empty on the claim. |

## Claim properties

### Claim

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Payer ID | `payerId` | payer ID | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The primary payer's ID. Setting it re-points the primary coverage's payer and the claim's insurer. Cannot be cleared — setting it requires a value. |
| Claim type | `type` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim type (professional or institutional). Allowed values: `professional` (Professional), `institutional` (Institutional). Cannot be cleared — setting it requires a value. |
| Service category | `service` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The service category code on the claim (e.g. urgent-care, workers-comp). Categories are configurable, so the value is free text. |
| Service date | `serviceDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The date of service (read from the first service line). Setting it applies the one date to every service line, matching the claim editor. Cannot be cleared — setting it requires a value. |
| Created date | `created` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | no | The date the claim was created. Read-only. |
| Billing type | `billingType` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | no | Whether the claim bills insurance or the patient. Derived from whether the claim carries a real coverage, so it is read-only (attach or remove a coverage to change it). Allowed values: `Insurance Pay`, `Self Pay`. |
| Billed amount | `billed` | number | equals, does not equal, is greater than, is at least, is less than, is at most, is present, is empty | no | The claim total in dollars. Derived from the sum of service line charges, so it is read-only — it is recomputed when a rule updates line charges or removes lines. |
| Diagnosis codes | `diagnosisCodes` | list of codes | contains, does not contain, matches pattern, does not match pattern, is present, is empty | no | The list of ICD-10 diagnosis codes on the claim. Use contains / does-not-contain to test for a code; read-only (rules cannot restructure the diagnosis list). |
| Procedure (CPT) codes | `cptCodes` | list of codes | contains, does not contain, matches pattern, does not match pattern, is present, is empty | no | The list of CPT/HCPCS codes across the service lines. Use contains / does-not-contain to test for a code; change codes with the "Update service lines" action. |
| Duplicate CPT codes | `duplicateCptCodes` | list of codes | contains, does not contain, matches pattern, does not match pattern, is present, is empty | no | The CPT/HCPCS codes that appear on more than one service line (empty when every line has a distinct code). "Is present" detects any duplicate billing; "contains" detects duplicates of a specific code. |
| Place of service codes | `placeOfServiceCodes` | list of codes | contains, does not contain, matches pattern, does not match pattern, is present, is empty | no | The list of CMS place-of-service codes across the service lines. Change per-line codes with the "Update service lines" action; the service facility place of service applies to future claims. |
| Service line count | `serviceLineCount` | number | equals, does not equal, is greater than, is at least, is less than, is at most | no | The number of service lines on the claim (0 when there are none). |
| Bill Type | `billType` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | Bill Type code on the claim |
| Patient Discharge Status Code | `patientDischargeStatusCode` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | Patient Discharge Status Code on the claim |
| Admission Type | `admissionType` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | Admission Type code on the claim |
| Point of Origin / Admission Source | `admissionSource` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | Point of Origin / Admission Source code on the claim |

### Claim status

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| AR Stage | `status.arStage` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's AR Stage indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `insurance-payer-ar` (Insurance Payer AR), `patient-ar` (Patient AR), `non-insurance-payer-ar` (Non-insurance Payer AR). |
| Insurance AR Status | `status.insuranceArStatus` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's Insurance AR Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `created` (Created), `submitted` (Submitted), `adjudicated` (Adjudicated), `finalized` (Finalized). |
| Insurance Paid Status | `status.insurancePaidStatus` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's Insurance Paid Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `unpaid` (Unpaid), `partially-paid` (Partially paid), `fully-paid` (Fully paid). |
| Adjudication Status | `status.adjudicationStatus` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's Adjudication Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `approved` (Approved), `rejected` (Rejected), `denied` (Denied). |
| Patient AR Status | `status.patientArStatus` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's Patient AR Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `not-invoiced` (Not invoiced), `ready-to-invoice` (Ready to invoice), `invoiced` (Invoiced), `finalized` (Finalized). |
| Patient Paid Status | `status.patientPaidStatus` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's Patient Paid Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `unpaid` (Unpaid), `partially-paid` (Partially paid), `fully-paid` (Fully paid). |
| Non-insurance AR Status | `status.nonInsuranceArStatus` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's Non-insurance AR Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `created` (Created), `ready-to-invoice` (Ready to invoice), `invoiced` (Invoiced), `finalized` (Finalized). |
| Non-insurance Paid Status | `status.nonInsurancePaidStatus` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The claim's Non-insurance Paid Status indicator. Setting it rewrites the corresponding status tag on the claim (setting AR Stage also initializes that stage's progress status, as the claim screens do). Allowed values: `unpaid` (Unpaid), `partially-paid` (Partially paid), `fully-paid` (Fully paid). |

### Patient

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| First name | `patient.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The patient's first (given) name. |
| Middle name | `patient.middleName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The patient's middle name (second given name). |
| Last name | `patient.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The patient's last (family) name. |
| Date of birth | `patient.birthDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The patient's date of birth (YYYY-MM-DD). |
| Gender | `patient.gender` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The patient's administrative gender. Allowed values: `male` (Male), `female` (Female), `other` (Other), `unknown` (Unknown). |
| Address line 1 | `patient.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The first street line of the patient's address. |
| Address line 2 | `patient.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The second street line of the patient's address. |
| City | `patient.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The city of the patient's address. |
| State | `patient.state` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The state of the patient's address (two-letter code, e.g. CA). Allowed values: any two-letter US state/territory code. |
| ZIP code | `patient.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The postal code of the patient's address. Format: 5 digits, optionally with a 4-digit extension. |

### Primary insurance

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Coverage (from patient) | `insurance.coverageFromPatient` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | Which of the patient's coverages the claim uses as its primary coverage, looked up on the claim patient's reference record via the patient's billing accounts. Conditions compare against the coverage the claim's current primary coverage was copied from; setting it creates a fresh working copy of the chosen coverage (and its policy holder) and re-points the claim — later rules read and edit the new copy. If the patient has no active coverage of the chosen type, the rule fails and the claim is held. Allowed values: `primary` (Primary), `secondary` (Secondary), `tertiary` (Tertiary), `quaternary` (Quaternary), `workersComp` (Workers Comp). Cannot be cleared — setting it requires a value. |
| Payer ID | `insurance.payerId` | payer ID | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The primary payer's ID. Setting it re-points the primary coverage's payer. Cannot be cleared — setting it requires a value. |
| Member ID | `insurance.memberId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The primary coverage's member/subscriber ID. |
| Plan type | `insurance.planType` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The primary coverage's plan type (X12 insurance type code). Allowed values: `09` (09 - Self Pay), `11` (11 - Other Non-Federal Programs), `12` (12 - PPO), `13` (13 - POS), `14` (14 - EPO), `15` (15 - Indemnity Insurance), `16` (16 - HMO Medicare Risk), `17` (17 - DMO), `AM` (AM - Auto), `BL` (BL - BlueCross BlueShield), `CH` (CH - Champus), `CI` (CI - Commercial Insurance Co), `DS` (DS - Disability), `FI` (FI - Federal Employees), `HM` (HM - HMO), `LM` (LM - Liability), `MA` (MA - Medicare Part A), `MB` (MB - Medicare Part B), `MC` (MC - Medicaid), `OF` (OF - Other Federal Program), `TV` (TV - Title V), `VA` (VA - Veterans Affairs Plan), `WC` (WC - Workers Comp Health Claim), `ZZ` (ZZ - Mutually Defined). Cannot be cleared — setting it requires a value. |
| Relationship to subscriber | `insurance.relationship` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | no | The patient's relationship to the primary policy holder. Read-only: changing it restructures the policy-holder record, which rules cannot do — edit the claim's insurance instead. Allowed values: `Self`, `Child`, `Parent`, `Spouse`, `Common Law Spouse`, `Injured Party`, `Other`. |

### Primary insurance policy holder

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| First name | `policyHolder.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The primary policy holder's first (given) name. |
| Middle name | `policyHolder.middleName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The primary policy holder's middle name (second given name). |
| Last name | `policyHolder.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The primary policy holder's last (family) name. |
| Date of birth | `policyHolder.birthDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The primary policy holder's date of birth (YYYY-MM-DD). |
| Gender | `policyHolder.gender` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The primary policy holder's administrative gender. Allowed values: `male` (Male), `female` (Female), `other` (Other), `unknown` (Unknown). |
| Address line 1 | `policyHolder.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The first street line of the primary policy holder's address. |
| Address line 2 | `policyHolder.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The second street line of the primary policy holder's address. |
| City | `policyHolder.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The city of the primary policy holder's address. |
| State | `policyHolder.state` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The state of the primary policy holder's address (two-letter code, e.g. CA). Allowed values: any two-letter US state/territory code. |
| ZIP code | `policyHolder.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The postal code of the primary policy holder's address. Format: 5 digits, optionally with a 4-digit extension. |

### Secondary insurance

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Coverage (from patient) | `secondaryInsurance.coverageFromPatient` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | Which of the patient's coverages the claim uses as its secondary coverage, looked up on the claim patient's reference record via the patient's billing accounts. Conditions compare against the coverage the claim's current secondary coverage was copied from; setting it creates a fresh working copy of the chosen coverage (and its policy holder) and re-points the claim — later rules read and edit the new copy. If the patient has no active coverage of the chosen type, the rule fails and the claim is held. Allowed values: `primary` (Primary), `secondary` (Secondary), `tertiary` (Tertiary), `quaternary` (Quaternary), `workersComp` (Workers Comp). Cannot be cleared — setting it requires a value. |
| Payer ID | `secondaryInsurance.payerId` | payer ID | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The secondary payer's ID. Setting it re-points the secondary coverage's payer. Cannot be cleared — setting it requires a value. |
| Member ID | `secondaryInsurance.memberId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The secondary coverage's member/subscriber ID. |
| Plan type | `secondaryInsurance.planType` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The secondary coverage's plan type (X12 insurance type code). Allowed values: `09` (09 - Self Pay), `11` (11 - Other Non-Federal Programs), `12` (12 - PPO), `13` (13 - POS), `14` (14 - EPO), `15` (15 - Indemnity Insurance), `16` (16 - HMO Medicare Risk), `17` (17 - DMO), `AM` (AM - Auto), `BL` (BL - BlueCross BlueShield), `CH` (CH - Champus), `CI` (CI - Commercial Insurance Co), `DS` (DS - Disability), `FI` (FI - Federal Employees), `HM` (HM - HMO), `LM` (LM - Liability), `MA` (MA - Medicare Part A), `MB` (MB - Medicare Part B), `MC` (MC - Medicaid), `OF` (OF - Other Federal Program), `TV` (TV - Title V), `VA` (VA - Veterans Affairs Plan), `WC` (WC - Workers Comp Health Claim), `ZZ` (ZZ - Mutually Defined). Cannot be cleared — setting it requires a value. |
| Relationship to subscriber | `secondaryInsurance.relationship` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | no | The patient's relationship to the secondary policy holder. Read-only: changing it restructures the policy-holder record, which rules cannot do — edit the claim's insurance instead. Allowed values: `Self`, `Child`, `Parent`, `Spouse`, `Common Law Spouse`, `Injured Party`, `Other`. |

### Secondary insurance policy holder

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| First name | `secondaryPolicyHolder.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The secondary policy holder's first (given) name. |
| Middle name | `secondaryPolicyHolder.middleName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The secondary policy holder's middle name (second given name). |
| Last name | `secondaryPolicyHolder.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The secondary policy holder's last (family) name. |
| Date of birth | `secondaryPolicyHolder.birthDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The secondary policy holder's date of birth (YYYY-MM-DD). |
| Gender | `secondaryPolicyHolder.gender` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The secondary policy holder's administrative gender. Allowed values: `male` (Male), `female` (Female), `other` (Other), `unknown` (Unknown). |
| Address line 1 | `secondaryPolicyHolder.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The first street line of the secondary policy holder's address. |
| Address line 2 | `secondaryPolicyHolder.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The second street line of the secondary policy holder's address. |
| City | `secondaryPolicyHolder.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The city of the secondary policy holder's address. |
| State | `secondaryPolicyHolder.state` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The state of the secondary policy holder's address (two-letter code, e.g. CA). Allowed values: any two-letter US state/territory code. |
| ZIP code | `secondaryPolicyHolder.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The postal code of the secondary policy holder's address. Format: 5 digits, optionally with a 4-digit extension. |

### Tertiary insurance

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Coverage (from patient) | `tertiaryInsurance.coverageFromPatient` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | Which of the patient's coverages the claim uses as its tertiary coverage, looked up on the claim patient's reference record via the patient's billing accounts. Conditions compare against the coverage the claim's current tertiary coverage was copied from; setting it creates a fresh working copy of the chosen coverage (and its policy holder) and re-points the claim — later rules read and edit the new copy. If the patient has no active coverage of the chosen type, the rule fails and the claim is held. Allowed values: `primary` (Primary), `secondary` (Secondary), `tertiary` (Tertiary), `quaternary` (Quaternary), `workersComp` (Workers Comp). Cannot be cleared — setting it requires a value. |
| Payer ID | `tertiaryInsurance.payerId` | payer ID | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The tertiary payer's ID. Setting it re-points the tertiary coverage's payer. Cannot be cleared — setting it requires a value. |
| Member ID | `tertiaryInsurance.memberId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The tertiary coverage's member/subscriber ID. |
| Plan type | `tertiaryInsurance.planType` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The tertiary coverage's plan type (X12 insurance type code). Allowed values: `09` (09 - Self Pay), `11` (11 - Other Non-Federal Programs), `12` (12 - PPO), `13` (13 - POS), `14` (14 - EPO), `15` (15 - Indemnity Insurance), `16` (16 - HMO Medicare Risk), `17` (17 - DMO), `AM` (AM - Auto), `BL` (BL - BlueCross BlueShield), `CH` (CH - Champus), `CI` (CI - Commercial Insurance Co), `DS` (DS - Disability), `FI` (FI - Federal Employees), `HM` (HM - HMO), `LM` (LM - Liability), `MA` (MA - Medicare Part A), `MB` (MB - Medicare Part B), `MC` (MC - Medicaid), `OF` (OF - Other Federal Program), `TV` (TV - Title V), `VA` (VA - Veterans Affairs Plan), `WC` (WC - Workers Comp Health Claim), `ZZ` (ZZ - Mutually Defined). Cannot be cleared — setting it requires a value. |
| Relationship to subscriber | `tertiaryInsurance.relationship` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | no | The patient's relationship to the tertiary policy holder. Read-only: changing it restructures the policy-holder record, which rules cannot do — edit the claim's insurance instead. Allowed values: `Self`, `Child`, `Parent`, `Spouse`, `Common Law Spouse`, `Injured Party`, `Other`. |

### Tertiary insurance policy holder

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| First name | `tertiaryPolicyHolder.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The tertiary policy holder's first (given) name. |
| Middle name | `tertiaryPolicyHolder.middleName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The tertiary policy holder's middle name (second given name). |
| Last name | `tertiaryPolicyHolder.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The tertiary policy holder's last (family) name. |
| Date of birth | `tertiaryPolicyHolder.birthDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The tertiary policy holder's date of birth (YYYY-MM-DD). |
| Gender | `tertiaryPolicyHolder.gender` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The tertiary policy holder's administrative gender. Allowed values: `male` (Male), `female` (Female), `other` (Other), `unknown` (Unknown). |
| Address line 1 | `tertiaryPolicyHolder.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The first street line of the tertiary policy holder's address. |
| Address line 2 | `tertiaryPolicyHolder.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The second street line of the tertiary policy holder's address. |
| City | `tertiaryPolicyHolder.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The city of the tertiary policy holder's address. |
| State | `tertiaryPolicyHolder.state` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The state of the tertiary policy holder's address (two-letter code, e.g. CA). Allowed values: any two-letter US state/territory code. |
| ZIP code | `tertiaryPolicyHolder.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The postal code of the tertiary policy holder's address. Format: 5 digits, optionally with a 4-digit extension. |

### Quaternary insurance

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Coverage (from patient) | `quaternaryInsurance.coverageFromPatient` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | Which of the patient's coverages the claim uses as its quaternary coverage, looked up on the claim patient's reference record via the patient's billing accounts. Conditions compare against the coverage the claim's current quaternary coverage was copied from; setting it creates a fresh working copy of the chosen coverage (and its policy holder) and re-points the claim — later rules read and edit the new copy. If the patient has no active coverage of the chosen type, the rule fails and the claim is held. Allowed values: `primary` (Primary), `secondary` (Secondary), `tertiary` (Tertiary), `quaternary` (Quaternary), `workersComp` (Workers Comp). Cannot be cleared — setting it requires a value. |
| Payer ID | `quaternaryInsurance.payerId` | payer ID | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The quaternary payer's ID. Setting it re-points the quaternary coverage's payer. Cannot be cleared — setting it requires a value. |
| Member ID | `quaternaryInsurance.memberId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The quaternary coverage's member/subscriber ID. |
| Plan type | `quaternaryInsurance.planType` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The quaternary coverage's plan type (X12 insurance type code). Allowed values: `09` (09 - Self Pay), `11` (11 - Other Non-Federal Programs), `12` (12 - PPO), `13` (13 - POS), `14` (14 - EPO), `15` (15 - Indemnity Insurance), `16` (16 - HMO Medicare Risk), `17` (17 - DMO), `AM` (AM - Auto), `BL` (BL - BlueCross BlueShield), `CH` (CH - Champus), `CI` (CI - Commercial Insurance Co), `DS` (DS - Disability), `FI` (FI - Federal Employees), `HM` (HM - HMO), `LM` (LM - Liability), `MA` (MA - Medicare Part A), `MB` (MB - Medicare Part B), `MC` (MC - Medicaid), `OF` (OF - Other Federal Program), `TV` (TV - Title V), `VA` (VA - Veterans Affairs Plan), `WC` (WC - Workers Comp Health Claim), `ZZ` (ZZ - Mutually Defined). Cannot be cleared — setting it requires a value. |
| Relationship to subscriber | `quaternaryInsurance.relationship` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | no | The patient's relationship to the quaternary policy holder. Read-only: changing it restructures the policy-holder record, which rules cannot do — edit the claim's insurance instead. Allowed values: `Self`, `Child`, `Parent`, `Spouse`, `Common Law Spouse`, `Injured Party`, `Other`. |

### Quaternary insurance policy holder

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| First name | `quaternaryPolicyHolder.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The quaternary policy holder's first (given) name. |
| Middle name | `quaternaryPolicyHolder.middleName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The quaternary policy holder's middle name (second given name). |
| Last name | `quaternaryPolicyHolder.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The quaternary policy holder's last (family) name. |
| Date of birth | `quaternaryPolicyHolder.birthDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The quaternary policy holder's date of birth (YYYY-MM-DD). |
| Gender | `quaternaryPolicyHolder.gender` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The quaternary policy holder's administrative gender. Allowed values: `male` (Male), `female` (Female), `other` (Other), `unknown` (Unknown). |
| Address line 1 | `quaternaryPolicyHolder.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The first street line of the quaternary policy holder's address. |
| Address line 2 | `quaternaryPolicyHolder.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The second street line of the quaternary policy holder's address. |
| City | `quaternaryPolicyHolder.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The city of the quaternary policy holder's address. |
| State | `quaternaryPolicyHolder.state` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The state of the quaternary policy holder's address (two-letter code, e.g. CA). Allowed values: any two-letter US state/territory code. |
| ZIP code | `quaternaryPolicyHolder.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The postal code of the quaternary policy holder's address. Format: 5 digits, optionally with a 4-digit extension. |

### Rendering provider

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Provider (from list) | `renderingProvider.ref` | provider reference | equals, does not equal, is one of, is not one of, is present, is empty | yes | Which rendering provider the claim uses, as a reference resource from the Rendering Providers page. Conditions compare against the resource the claim's current rendering provider was copied from; setting it creates a fresh working copy of the chosen provider and re-points the claim — later rules read and edit the new copy. Cannot be cleared — setting it requires a value. |
| NPI | `renderingProvider.npi` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The rendering provider's NPI. Format: a valid 10-digit NPI. |
| First name | `renderingProvider.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The rendering provider's first name (individual providers only; setting it on an organization provider fails the rule). |
| Last name / organization name | `renderingProvider.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The rendering provider's last name, or the organization name for organization providers. |
| Taxonomy code | `renderingProvider.taxonomy` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The rendering provider's taxonomy code. Format: exactly 10 characters. |

### Billing provider

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Provider (from list) | `billingProvider.ref` | provider reference | equals, does not equal, is one of, is not one of, is present, is empty | yes | Which billing provider the claim uses, as a reference resource from the Billing Providers page. Conditions compare against the resource the claim's current billing provider was copied from; setting it creates a fresh working copy of the chosen provider and re-points the claim — later rules read and edit the new copy. Cannot be cleared — setting it requires a value. |
| NPI | `billingProvider.npi` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The billing provider's NPI. Format: a valid 10-digit NPI. |
| First name | `billingProvider.firstName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The billing provider's first name (individual providers only; setting it on an organization provider fails the rule). |
| Last name / organization name | `billingProvider.lastName` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The billing provider's last name, or the organization name for organization providers. |
| Taxonomy code | `billingProvider.taxonomy` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The billing provider's taxonomy code. Format: exactly 10 characters. |
| Tax ID (TIN) | `billingProvider.taxId` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The billing provider's tax ID (TIN). Format: exactly 9 digits. |

### Service facility

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Facility (from list) | `serviceFacility.ref` | facility reference | equals, does not equal, is one of, is not one of, is present, is empty | yes | Which service facility the claim uses, as a reference resource from the Service Facilities page. Conditions compare against the resource the claim's current facility was copied from; setting it creates a fresh working copy of the chosen facility and re-points the claim — later rules read and edit the new copy. Cannot be cleared — setting it requires a value. |
| Facility name | `serviceFacility.name` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The service facility's name. |
| Facility NPI | `serviceFacility.npi` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The service facility's NPI. Format: a valid 10-digit NPI. |
| CLIA number | `serviceFacility.clia` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The service facility's CLIA number. Format: format NNDNNNNNNN, e.g. 05D1234567. |
| Place of service code | `serviceFacility.posCode` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The service facility's CMS place-of-service code (e.g. 11 for office, 20 for urgent care). Allowed values: any CMS place-of-service code. |
| Address line 1 | `serviceFacility.addressLine1` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The first street line of the service facility's address. |
| Address line 2 | `serviceFacility.addressLine2` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The second street line of the service facility's address. |
| City | `serviceFacility.city` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The city of the service facility's address. |
| State | `serviceFacility.state` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The state of the service facility's address (two-letter code, e.g. CA). Allowed values: any two-letter US state/territory code. |
| ZIP code | `serviceFacility.zip` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The postal code of the service facility's address. Format: 5 digits, optionally with a 4-digit extension. |

### Tags

| Property | ID | Type | Operators | Settable | Description |
| --- | --- | --- | --- | --- | --- |
| Claim tags | `tags` | list of codes | contains, does not contain, matches pattern, does not match pattern, is present, is empty | no | The list of tags on the claim. Use contains / does-not-contain to test for a tag; add tags with the "Apply a tag" action. |

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
| CPT code | `cptCode` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | The line's CPT/HCPCS procedure code. Setting it replaces the line's procedure coding. |
| Modifiers | `modifiers` | list of codes | contains, does not contain, matches pattern, does not match pattern, is present, is empty | yes | The line's procedure modifiers. When updating, the operation chooses how the value applies: "set" replaces the whole list (comma-separated; empty clears it), "add" appends one modifier, "remove" drops one. |
| Units | `units` | number | equals, does not equal, is greater than, is at least, is less than, is at most, is present, is empty | yes | The line's unit count. Setting it requires a positive number. |
| Charges | `charges` | number | equals, does not equal, is greater than, is at least, is less than, is at most, is present, is empty | yes | The line's charge amount in dollars. Setting it requires a non-negative number; the claim's billed total is recomputed. |
| Place of service code | `placeOfService` | one of the listed values | equals, does not equal, is one of, is not one of, matches pattern, does not match pattern, is present, is empty | yes | The line's CMS place-of-service code. Setting an empty value clears it. Allowed values: any CMS place-of-service code. |
| Service date | `serviceDate` | date | equals, does not equal, is one of, is not one of, is after, is on or after, is before, is on or before, is present, is empty | yes | The line's date of service (YYYY-MM-DD). |
| Rev Code | `revenueCode` | text | equals, does not equal, is one of, is not one of, contains, does not contain, starts with, does not start with, matches pattern, does not match pattern, is present, is empty | yes | Revenue code of the procedure. |

## Actions

A matched branch's outcome is a list of actions, applied in order:

| Action | Description |
| --- | --- |
| Set a property (`setField`) | Sets one of the settable claim properties above to a new value. Setting an empty value clears the property. The change is written to the claim's working-copy resources and recorded in the claim history, attributed to the specific rule that made it (linked from the history view). If the property cannot be set (unknown or read-only property, invalid value, or the target resource is missing from the claim), the rule fails and the claim is held. |
| Apply a tag (`applyTag`) | Adds a tag to the claim (no-op if the claim already carries it). Applying the **Hold** tag holds the claim: the run stops and the on-success effect does not happen. |
| Add a service line (`addServiceLine`) | Appends a new service line built from the fields below and recomputes the claim's billed total. Blank optional fields use the claim editor's defaults, and the new line is tied to the claim's rendering provider when one is set. An invalid field value fails the rule and holds the claim. |
| Update service lines (`updateServiceLines`) | Applies one change (an updatable service line property + value; for modifiers, a set/add/remove operation) to every line matching the action's line predicate. Zero matching lines is a no-op, not a failure — pair the action with a condition when a match must exist. An invalid value or an operation that doesn't apply to the property fails the rule and holds the claim. Changing charges recomputes the claim's billed total. |
| Remove service lines (`removeServiceLines`) | Removes every line matching the action's line predicate (all lines when the predicate is "all service lines"). Surviving lines are re-sequenced and the claim's billed total is recomputed. Zero matching lines is a no-op. |
| Apply charge master prices (`applyChargeMasterPrices`) | Re-prices every line matching the action's line predicate from the best applicable charge master: the active charge master designated as the default for the claim's billing type (insurance when the claim carries a real coverage, self-pay otherwise) whose effective date is the most recent on or before the claim's date of service. Each matched line's charges are set from the entry for its CPT code — an entry with a matching modifier for lines with modifiers, a modifier-less entry otherwise. A matched line the charge master has no entry for (or that has no CPT code) keeps its existing charges. The claim's billed total is recomputed when any line was re-priced. Zero matching lines is a no-op. This action never fails the rule or holds the claim — when no charge master applies (or the claim has no date of service to select one by), no lines are changed. Add a separate rule to hold claims whose lines are missing a price. |
| Do nothing (`noop`) | Explicitly does nothing. Useful as an else branch that intentionally takes no action. |

### "Add a service line" fields

| Field | Type | Required | When left blank |
| --- | --- | --- | --- |
| CPT code (`cptCode`) | text | yes | — |
| Charges (`charges`) | number | yes | — |
| Units (`units`) | number | no | 1 |
| Modifiers (comma-separated) (`modifiers`) | text | no | no modifiers |
| Place of service code (`placeOfService`) | text | no | none |
| Service date (`serviceDate`) | date | no | inherited from the claim's first service line; the action fails if the claim has no lines |
| Diagnoses (`diagnosisMode`) | one of the listed values | no | uses the claim's primary diagnosis |
| Diagnosis pointers (comma-separated) (`diagnosisPointers`) | text | yes | — |
| Revenue code (`revenueCode`) | text | no | — |

Actions after a failed action or after the **Hold** tag do not run.
