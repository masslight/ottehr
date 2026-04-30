## Patient Instructions: Replace "Ottehr Templates" with Practice Quick Picks

### Current state

The Plan tab's Patient Instructions section has two preset-template buttons next to the instruction entry field: "My Templates" (per-provider templates a user can save and reuse) and "{Brand} Templates" (an organization-scoped list of preset templates intended to be shared across the practice). The org-scoped list is backed by FHIR `Communication` resources and has no admin UI — there is no way for an organization to actually create, edit, or remove its presets without backend access. As a result the feature has never been used in any environment, and no production data exists for org-scoped templates. No migration path is required.

### Why we're changing it

The new "Quick Picks" framework already provides a self-service admin experience for similar shared-preset features (allergies, medical conditions, medications, radiology, immunizations, in-house medications, procedures), all manageable from the EHR Admin → Quick Picks page. We want to bring patient-instruction presets into that same model so each practice can self-service curate its own list of shared instructions, without engineering involvement. To match the new system's vocabulary, we are also retiring the "templates" naming on the Plan page in favor of "quick picks."

### Requirements

- Rename the Plan page's "{Brand} Templates" button to **"Practice Quick Picks."** Clicking it opens a picker dialog of the practice's shared instructions.
- Rename the Plan page's "My Templates" button to **"My Quick Picks"** and "Add & Save as Template" to **"Add & Save to My Quick Picks"** (these continue to read/write the existing per-provider list — only the labels change).
- Add a new **"Patient Instructions"** tab to the EHR Admin Quick Picks page that supports full CRUD (add, edit, remove). Each entry has two fields: a short **title** (e.g. "Concussion follow-up") and a multi-line **instruction body**.
- Picker dialog (chart side) is **read-only**: providers can select an entry to populate the instruction field, but cannot create, edit, or delete from this dialog. All curation happens in Admin.
- Entries in the chart-side Practice Quick Picks dialog are **sorted alphabetically by title** (case-insensitive).
- Scoping matches existing quick-pick categories: shared across the entire practice (Oystehr project), no per-user or per-location scoping.
