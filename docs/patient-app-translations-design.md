# Patient App Translations — Technical Design

_Status: implemented for the registration + paperwork flow (English/Spanish). Scope here is the patient-facing intake app (`apps/intake`)._

## Current state

The intake app is a React + Vite app already wired for internationalization:

- **i18next** (`react-i18next` + `i18next-browser-languagedetector`) is initialized from two bundled resource files, `apps/intake/src/lib/i18n-en.json` and `i18n-es.json`. Browser language is auto-detected and cached; a `LanguagePicker` lets the patient override it.
- **App "chrome"** (buttons, titles, nav, errors) is rendered through `t('…')` keys in those JSON files.
- **Paperwork/registration form content** is different: it is driven by **FHIR `Questionnaire` resources**, and the renderer (`PagedQuestionnaire`) printed `item.text`, answer-option values, and helper/validation text **directly**, with no translation path. Those questionnaires are generated from config (`packages/utils/lib/ottehr-config/...`) and deployed as versioned canonical FHIR resources.

So before this work: chrome was translatable, but the actual questions, options, consent text, and validation messages were English-only, and a meaningful amount of copy was hardcoded in components.

## Goal

Offer the **registration and paperwork** experience in Spanish, in a way that:

1. extends cleanly to **any language** later, and
2. can eventually be made **self-service** so customers supply their own translations,

without forking or hand-editing the canonical FHIR questionnaires per language.

## Where to store translations: FHIR extension vs. i18n

**Option A — FHIR SDC translation extension.** FHIR supports localized content via the `http://hl7.org/fhir/StructureDefinition/translation` extension on element `_value` nodes (e.g. on `Questionnaire.item.text`). Translations live inside the resource.

- ➖ Our questionnaires are **generated from config and version-pinned**; editing them per-translation means regenerating/bumping canonical resources for every wording or language change.
- ➖ Structure and translations would share one lifecycle even though they have different owners (engineering owns structure; a customer/translator owns wording).
- ➖ The app would need a second, FHIR-specific resolution path in addition to i18next.

**Option B — i18n layer (chosen).** Resolve questionnaire content through i18next too, keyed by the item's stable `linkId`:

```ts
t(`questionnaire.${linkId}`, { defaultValue: item.text })
```

- ➕ The app **already** carries an i18n configuration layer for chrome; questionnaire copy is just more configuration, so keeping it all in one place is simpler than maintaining two systems.
- ➕ English keeps working with **zero new data** — the questionnaire's own `item.text` is the `defaultValue`, so any untranslated key falls back to English.
- ➕ Translations are decoupled from the version-pinned FHIR resources and can change on their own cadence.

**Decision:** Option B. Since some configuration has to live in the i18n layer regardless, we put *all* of it there rather than splitting translations across FHIR resources and i18n.

### What that meant in practice
- Routed `PagedQuestionnaire` (and the answer-option, file-upload, and validation paths) through the i18n layer, keyed by `linkId` (option labels keyed by value; `infoText`/`attachmentText`/placeholder by suffix), always with the English `defaultValue` fallback.
- Moved remaining hardcoded component strings into i18next.
- Re-enabled the language picker and fixed a debug handler that masked the English fallback with a "No translation found" placeholder.
- Added Spanish for the booking, in-person, and virtual questionnaires plus the chrome.

## Making it self-service (future)

The same i18n shape supports per-customer translations without code changes:

- A customer uploads their own `i18n.<lang>.json` (matching our key structure) to **Z3** object storage for their project.
- At runtime the app fetches it and injects it with i18next (`addResourceBundle`, or an `i18next-http-backend` `loadPath` pointing at a zambda that serves the file), layered over the shipped defaults.
- Because every lookup already falls back to the English `defaultValue`, partial customer files degrade gracefully.

This keeps translation authoring in a familiar JSON format and out of the canonical FHIR resources, and lets each instance (which ships its own questionnaires) maintain its own translations.

## Keeping translations in sync (contract tests)

Two CI contract tests guard against drift:

1. **Questionnaire coverage** (`questionnaire-translation-coverage.test.ts`) — regenerates the booking + in-person + virtual questionnaires **from config** (not from archived JSON), reconstructs the expected `questionnaire.<linkId>…` keys, and asserts `i18n-es.json` has a non-empty Spanish value for each (minus a small documented allowlist of hidden internal fields). Adding a questionnaire field/option without Spanish fails CI.
2. **Key parity** (`i18n-key-parity.test.ts`) — asserts `i18n-en.json` and `i18n-es.json` have identical key sets for chrome, so neither locale drifts. The `questionnaire.*` namespace is intentionally Spanish-only (English comes from `defaultValue`) and is excluded.

Together these let translations be added incrementally and per-instance while CI catches missing or orphaned keys.
