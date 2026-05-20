# In-House Lab Orders in Global Templates

## Background

Providers can save the current progress note as a global template and apply that template to a future visit. Today, the template carries HPI, MOI, ROS, exam findings, MDM, diagnoses, patient instructions, CPT codes, E&M code, and accident — but **not in-house lab orders**.

A provider building a template for "sore throat, suspect strep" can capture the assessment and CPT codes for a strep rapid test, but the actual lab order itself doesn't travel with the template. When the template is applied, the provider still has to remember to order the lab manually. That's friction the template was supposed to remove.

## Goal

Let providers save in-house lab orders into a global template, and have those orders re-create themselves automatically when the template is applied. The saved template should be **resilient over time**: if the lab catalog updates a test's definition (new version, refined CPTs, updated instructions), the template should pick up the current definition at apply time rather than freezing on whatever was current when the template was saved.

## Saving a template

The list of sections shown in the "Save Note As Template" confirmation popup now includes **"In-House Lab Orders"** so providers know their orders will be persisted.

When the template is saved, the system captures, for each in-house lab order on the visit:

- The test being ordered, referenced by its identity in the lab catalog (not by a pinned version — see *Resilience to catalog changes* below).
- The ICD-10 diagnoses the provider attached to that order as the reason for ordering.
- Any free-text order notes the provider entered.

**Excluded from the template:**

- Orders the provider canceled or marked as a mistake. The chart hides these from the visit; the template should too.
- Tests whose definition is no longer published in the lab catalog get captured as plans but will surface as "unavailable" when the template is viewed or applied (see below).

## Applying a template

When a provider applies a template that includes in-house lab orders, the system re-orders each saved lab on the new visit, attached to the new patient and encounter, using the **current** active definition of each test.

- The provider applying the template is recorded as the order's requester (this may differ from the visit's attending, especially when a nurse or another staffer applies the template).
- The diagnoses and notes that were saved into the template carry over to the new order.
- Each order's "collect sample" workflow is created the same way as if the provider had placed the order manually.

## Resilience to catalog changes

The lab catalog is versioned. New revisions of a test get published with a new version number (semantic versioning — e.g. `1.0.0` → `1.1.0` → `2.0.0`). The template stores only the test's identity, not a pinned version.

- At apply time, the system finds the current **active** definition of each test and uses that. If multiple versions exist, the highest version wins.
- Retired or draft versions of a test are ignored, even if their version number is higher than the active one (this can happen if a future version was published and then retracted).
- If no active definition exists in this environment for a saved test, the provider sees a warning ("Skipped …") and the rest of the template still applies. Other lab orders, diagnoses, exam findings, etc. all go through normally.

## In the preview dialog

A new **"In-House Lab Orders"** section appears in the apply-template preview dialog whenever the template carries any lab orders.

Each saved order is shown as a card with:

- The test name (resolved against the live catalog at preview time).
- The diagnoses the order will be linked to, as outlined chips.
- The CPT codes the test will charge for, as outlined chips (so the provider sees exactly what the lab section delivers — see *Overlap with the CPT Codes section* below).
- The order notes, if any.

If a saved order's test definition can't be resolved in the current environment, the order is rendered muted with an inline note: **"unavailable in this environment — will be skipped."** This signals to the provider that applying the template won't produce that order, without blocking the rest.

### Section action

The In-House Lab Orders section supports two actions: **Skip** and **Append**. It does **not** support Overwrite. Overwriting would mean deleting in-flight lab orders the provider may have already placed on the visit — orders that could already have collected specimens or recorded results. That's not a safe automatic action.

The default action is Append.

### After apply

If any orders were skipped because their definition is no longer active, the provider sees one warning toast per skipped lab. The successful orders are placed regardless.

## In the admin detail page

When an admin opens a template's detail page, the new **In-House Lab Orders** section lists each saved lab plan with:

- Test name (resolved against the live catalog).
- Diagnoses linked to it.
- Order notes.

If the test is no longer active in this environment, the plan is rendered muted with the inline warning **"activity definition not found in this environment — applies will skip this lab,"** so admins can spot templates that need to be re-saved against a current catalog.

The page does **not** show internal identifiers (catalog URLs, FHIR IDs, etc.) — those are too technical for the intended audience.

## Overlap with the CPT Codes section

When a template contains an in-house lab, the CPT codes attached to that lab are visible in **two places** in the preview:

1. As chips on the lab's own card in the In-House Lab Orders section.
2. As a row in the **CPT Codes** section.

This is intentional. The provider can choose which section actually delivers the CPT:

- Append the lab + skip the CPT section → the CPT arrives with the lab.
- Skip the lab + append the CPT section → the CPT arrives as a free-standing code (without the order workflow).
- Append both → the system **deduplicates** so only one CPT charge is created per code. No double-billing.

## Out of scope

- Editing a template's saved lab orders directly. Templates are re-saved from a note, not edited piece by piece.
- Applying a template's labs to a different patient or a different encounter than the one the provider is currently viewing.
- Carrying over collected specimens, recorded results, or any other in-flight lab state. Templates carry the *intent to order*, not active orders.
- Storing orders that were canceled on the saved-from visit.
- A dedicated "catalog version diff" view for admins — catalog management remains in the existing admin tools.
