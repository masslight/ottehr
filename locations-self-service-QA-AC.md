# QA Acceptance Criteria: Locations out of Terraform + fully self-service

## What changed (context for QA)
Locations used to be provisioned/managed via Terraform (IaC). This work removes Location
resources from Terraform management so they are **fully self-service in the EHR admin panel**,
and exposes **every configurable Location field** in the UI. Existing locations must be
preserved (not destroyed) by the migration.

- **Admin location panel:** EHR → **Admin → Practice → Locations** (`/admin/locations`), with a
  per-location detail page (`/admin/locations/<id>`).
- **Roles used below:**
  - **Administrator** and **Customer Support** — can view the Locations panel, edit most fields,
    deactivate, and delete.
  - **Customer Support only** — can *edit* the payment/radiology fields (Stripe Account ID,
    Advapacs Location ID). Administrator can *see* those fields but they're read-only.
  - A user without admin access should not reach the panel at all.

> Environment note: verify on an env that has **pre-existing (previously TF-managed) locations**
> so the "not destroyed" criteria are meaningful. `local`/`staging` on a hosted instance are good
> candidates.

---

## AC 1 — Locations are no longer Terraform-managed (migration safety)
1. **Existing locations survive the deploy.** After deploying this change, every location that
   existed beforehand is still present in Admin → Locations, with its name, address, slug,
   timezone, mode, and status unchanged. *Nothing is wiped.*
2. **Existing bookability is unaffected.** A previously-bookable location is still bookable
   (patient booking flow + EHR "Add Visit" still list it); its schedules, slugs, and booking
   links still resolve.
3. **A deploy no longer manages locations.** After creating/editing a location in admin
   (AC 2–4), a subsequent deploy / `terraform apply` does **not** delete, recreate, or overwrite
   it. *(This is the core "out of Terraform" guarantee. QA can confirm the observable outcome —
   the admin-created location is untouched after a deploy. The infra-level proof, that
   `terraform apply` reports no changes/destroys for Location resources, is enforced
   automatically by the "Ejection coverage" CI check on PRs and can be spot-confirmed with Eng.)*
4. **No code/Terraform change is needed to add a location** — it's done entirely in the UI (AC 2).

## AC 2 — Create a location (self-service)
1. **Add location** button on `/admin/locations` opens a dialog requesting a **Name**; creating
   it adds the location to the list and opens/enables its detail page.
2. The new location persists across a page reload and appears in the list search.
3. Creating a location requires no engineering involvement.

## AC 3 — All Location fields are configurable in admin
On the location detail page, each of the following can be edited, **Saved**, and the change
persists after reload. (Save writes via the self-service update endpoint.)

| Section | Fields |
|---|---|
| **Identity** | Name; **Mode** — "Virtual (Telemed)" and/or "In person" (at least one required — Save is blocked with a validation message if neither is checked; both may be selected) |
| **Permalink** | **Slug** — must be URL-safe (letters, digits, hyphens). Invalid values (spaces/symbols) are rejected with a validation error; empty clears the slug |
| **Timezone** | dropdown of supported timezones |
| **Description** | free text |
| **Address** | Street, Street line 2, City, State, Postal code |
| **Contact** | Phone, URL, Fax, Support phone, Review link |
| **Payments** *(Admin sees; CS edits)* | Stripe Account ID (format hint if not `acct_…`); Stripe Connect status + terminal reader info |
| **Radiology / Imaging** *(Admin sees; CS edits)* | Advapacs Location ID (format-validated) |
| **Rooms** | add, rename, and remove room entries |

**AC 3 checks:**
1. Editing any field above and clicking **Save** persists after reload.
2. **Mode is enforced:** unchecking both "Virtual" and "In person" shows the error and disables Save.
3. **Slug is validated:** e.g. `my location!` is rejected; `my-location-1` is accepted.
4. **Round-trip fidelity:** values entered match what's shown after reload (no truncation/reformatting surprises).

## AC 4 — Activate / Deactivate
1. The **Active/Inactive** toggle at the top of the detail page changes status **immediately**
   (separate from Save) and persists.
2. Deactivating a location removes it from patient-facing booking (and EHR booking) while keeping
   the record; reactivating restores it.
3. The list's **Status** column/filter reflects the current state.

## AC 5 — Delete (guarded)
1. **Delete location** (Danger zone) is only available to Administrator/Customer Support.
2. **Two-phase / dependents:** deleting a location that has dependent **Schedules, Provider roles,
   or Appointments** is refused on the first attempt with a warning describing the dependents
   ("Delete anyway?"). Confirming a second time force-deletes: dependent Schedules and Provider
   roles are removed, the location is deleted, **Appointments are preserved** (clinical history is
   never deleted).
3. Deleting a location with **no** dependents succeeds directly.
4. If the backend can't remove a location still referenced by appointments, the user sees a clear
   **"deactivate instead"** message (not a raw error).
5. A deleted location disappears from the list and can no longer be booked.

## AC 6 — Permissions
1. **Administrator:** full panel access; can edit non-payment fields, toggle status, delete;
   **payment/Advapacs fields are visible but read-only.**
2. **Customer Support:** as above **plus** can edit Stripe Account ID and Advapacs Location ID.
3. **Non-admin user:** cannot reach `/admin/locations` (and the underlying create/update/toggle/
   delete endpoints reject them — not just hidden UI).

## AC 7 — Downstream effects take hold
1. **Booking:** slug changes update the booking link/permalink; mode changes (virtual/in-person)
   affect where the location surfaces.
2. **Templates:** a configured **Review link** renders via `{{location-review-link}}`.
3. **Radiology:** a configured **Advapacs Location ID** flows into radiology order creation.
4. **Payments:** Stripe Account ID / terminal config is reflected in payment flows for that location.

---

## Negative / edge cases to spot-check
- Save with an invalid slug → rejected, no partial write.
- Save with neither mode selected → blocked.
- Delete with dependents → warning first, not immediate deletion.
- Create two locations with the same name → both allowed (name isn't a unique key); confirm the
  slug/permalink behavior is sensible.
- Deactivate then attempt to book → not offered to patients.
- Non-admin hitting the endpoints directly (if QA can) → 401/403.

## Notes / out of scope
- The **Ejection coverage** CI check guards the "no Location silently destroyed by Terraform"
  invariant on every PR; it's not something QA needs to run manually.
- Bulk import/migration of legacy locations, and the shape of the runtime seed, are infra
  concerns — QA verifies the *observable* result (existing locations intact, new ones self-service).
