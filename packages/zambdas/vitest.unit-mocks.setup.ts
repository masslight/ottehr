import { afterEach, vi } from 'vitest';

// Canonical, suite-wide mocks for every module that any unit test file needs to stub.
//
// WHY THIS FILE EXISTS — the unit suite runs with `--no-isolate` in CI (12x faster: the
// module graph is transformed and executed once per worker instead of once per file).
// Under a shared worker the module registry persists across test files, which breaks the
// old pattern of each test file registering its own `vi.mock('utils', factory)`:
//
//   1. A module like `src/shared/auth.ts` is executed once per worker. Whatever instance
//      of `utils` was active at that moment is captured in its imports forever. A later
//      file's own factory produces a NEW mock instance that the cached module never sees,
//      so the file's `vi.mocked(...)` handles are silently dead (observed: 30 tests
//      failing against real implementations, e.g. real `userMe` throwing "Invalid JWT").
//   2. Conversely, a file's factory that replaced a whole module leaked into every later
//      file in the worker, so tests could silently exercise a neighbor's mock.
//
// THE CONTRACT — exactly ONE mock registration per shared module, made here so it is in
// force before the first file in every worker imports anything:
//
//   - Every wrapped export is a `vi.fn` that DELEGATES TO THE REAL IMPLEMENTATION by
//     default, so files that never stub it keep today's behavior.
//   - A test that needs different behavior sets it in `beforeEach`/the test body via
//     `vi.mocked(fn).mockResolvedValue(...)` on the imported symbol — never with its own
//     `vi.mock(...)` factory for these modules (that reintroduces bug #1).
//   - The `afterEach` below resets every wrapper (call history AND implementation) so
//     nothing leaks between tests or files.
//   - Setup files re-execute for every test file even under --no-isolate, but the module
//     registry persists — so the mock namespaces are memoized on `globalThis` to keep the
//     `vi.fn` instances stable across re-executions. Cached importers and fresh importers
//     must see the SAME objects or per-file overrides stop working.
//
// Adding a new stub: add the export name to the module's list below (or a new vi.mock
// block following the same pattern). The `missing export` guard throws loudly if a wrapped
// name disappears from the real module, so this file cannot silently drift.

type AnyFn = (...args: any[]) => any;

interface ManagedMock {
  fn: ReturnType<typeof vi.fn>;
  impl: AnyFn | undefined;
}

const G = globalThis as {
  __zambdaCanonicalMockRegistry?: Map<string, Record<string, unknown>>;
  __zambdaManagedMocks?: ManagedMock[];
  __zambdaManagedResetters?: Array<() => void>;
};

const moduleRegistry = (G.__zambdaCanonicalMockRegistry ??= new Map());
const managedMocks = (G.__zambdaManagedMocks ??= []);
const managedResetters = (G.__zambdaManagedResetters ??= []);

/**
 * Build (once per worker) a mock namespace for `spec`: the real module with each named
 * export replaced by a resettable vi.fn. Entries are either an export name (delegates to
 * the real implementation) or `[name, impl]` (a canonical replacement implementation,
 * restored on reset — used where the real implementation must never run in unit tests).
 */
const wrapModule = (
  spec: string,
  actual: Record<string, unknown>,
  wrapped: Array<string | [string, AnyFn]>
): Record<string, unknown> => {
  const existing = moduleRegistry.get(spec);
  if (existing) return existing;

  const namespace: Record<string, unknown> = { ...actual };
  for (const entry of wrapped) {
    const [name, replacement] = typeof entry === 'string' ? [entry, undefined] : entry;
    if (!(name in actual) && replacement === undefined) {
      throw new Error(`Canonical unit mock: export "${name}" is missing from module "${spec}" — update this file.`);
    }
    const impl = replacement ?? (actual[name] as AnyFn | undefined);
    const fn = vi.fn(impl);
    managedMocks.push({ fn, impl });
    namespace[name] = fn;
  }
  moduleRegistry.set(spec, namespace);
  return namespace;
};

// Setup files re-run per test file, so this hook re-registers for each file's suite.
afterEach(() => {
  for (const { fn, impl } of managedMocks) {
    fn.mockReset();
    if (impl) fn.mockImplementation(impl);
  }
  for (const reset of managedResetters) reset();
});

// ---------------------------------------------------------------------------------------
// The `utils` package
// ---------------------------------------------------------------------------------------
vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const namespace = wrapModule('utils', actual, [
    'userMe',
    'createOystehrClient',
    'getPresignedURL',
    'createFetchClientWithOystehrAuth',
    'getSecret',
    'getOptionalSecret',
    'getStripeCustomerIdFromAccount',
    'getStripeAccountForAppointmentOrEncounter',
    'getOrCreateCandidApiClient',
    'findTerminalDeviceForLocation',
    'getRelatedPersonForPatient',
    'getAttendingPractitionerId',
  ]);
  // FEATURE_FLAGS_CONFIG is a frozen data object, not a function: expose a stable mutable
  // copy that tests may adjust (e.g. `Object.assign(FEATURE_FLAGS_CONFIG, {...})` in
  // beforeEach) and restore it to the real values after every test.
  if (!managedResetters.some((r) => (r as { flagsReset?: boolean }).flagsReset)) {
    const pristine = JSON.parse(JSON.stringify(actual.FEATURE_FLAGS_CONFIG));
    const mutableFlags = namespace.FEATURE_FLAGS_CONFIG as Record<string, unknown>;
    if (Object.isFrozen(mutableFlags)) {
      namespace.FEATURE_FLAGS_CONFIG = { ...pristine };
    }
    const flags = namespace.FEATURE_FLAGS_CONFIG as Record<string, unknown>;
    const reset = Object.assign(
      () => {
        for (const key of Object.keys(flags)) delete flags[key];
        Object.assign(flags, JSON.parse(JSON.stringify(pristine)));
      },
      { flagsReset: true }
    );
    managedResetters.push(reset);
  }
  return namespace;
});

// ---------------------------------------------------------------------------------------
// @sentry/aws-serverless — never load the real SDK in tests (SSR import issues). Same
// shape as the legacy mock in vitest.setup.ts, but with worker-stable instances; this
// registration is later in setupFiles order, so it wins for the unit project.
// ---------------------------------------------------------------------------------------
vi.mock('@sentry/aws-serverless', () =>
  wrapModule('@sentry/aws-serverless', {}, [
    ['init', () => undefined],
    ['isInitialized', () => false],
    ['setTag', () => undefined],
    ['setTags', () => undefined],
    ['captureException', () => undefined],
    ['captureMessage', () => undefined],
    ['withScope', (cb: (scope: { setTag: (k: string, v: unknown) => void }) => void) => cb({ setTag: vi.fn() })],
    // Pass the handler through unchanged.
    ['wrapHandler', (handler: AnyFn) => handler],
  ])
);

// ---------------------------------------------------------------------------------------
// src/shared submodules. The src/shared barrel does `export *` from these, so wrapping at
// the defining module covers imports through the barrel and direct submodule imports alike.
// ---------------------------------------------------------------------------------------
vi.mock('./src/shared/auth', async (importOriginal) =>
  wrapModule('src/shared/auth', await importOriginal(), ['checkOrCreateM2MClientToken', 'getUser'])
);

vi.mock('./src/shared/helpers', async (importOriginal) =>
  wrapModule('src/shared/helpers', await importOriginal(), [
    'createClinicalOystehrClient',
    'getPatchBinary',
    'resolveTimezone',
  ])
);

vi.mock('./src/shared/getAuth0Token', async (importOriginal) =>
  wrapModule('src/shared/getAuth0Token', await importOriginal(), ['getAuth0Token'])
);

// The lambda wrapper is applied AT IMPORT TIME (`export const index = wrapHandler(...)`),
// so under a shared registry there is exactly one chance to choose its behavior for the
// whole worker: the REAL wrapHandler, suite-wide. With @sentry/aws-serverless mocked above,
// the real wrapHandler reduces to the top-level-catch envelope (configSentry is inert), so
// tests observe production error semantics. Per-file passthrough stubs cannot work here —
// handlers bake the wrapper at import — and tests must assert the error envelope instead
// of a raw throw. Requires input.secrets to include ENVIRONMENT (configSentry reads it).
vi.mock('./src/shared/sentry', async (importOriginal) =>
  wrapModule('src/shared/sentry', await importOriginal(), ['wrapHandler'])
);

vi.mock('./src/shared/practitioners', async (importOriginal) =>
  wrapModule('src/shared/practitioners', await importOriginal(), ['getMyPractitionerId'])
);

vi.mock('./src/shared/candid', async (importOriginal) =>
  wrapModule('src/shared/candid', await importOriginal(), [
    'createEncounterFromAppointment',
    'performCandidPreEncounterSync',
  ])
);

vi.mock('./src/shared/communication', async (importOriginal) =>
  wrapModule('src/shared/communication', await importOriginal(), [
    'getEmailClient',
    'makeAddressUrl',
    'sendSmsForPatient',
  ])
);

vi.mock('./src/shared/z3Utils', async (importOriginal) =>
  wrapModule('src/shared/z3Utils', await importOriginal(), ['createPresignedUrl', 'uploadObjectToZ3', 'deleteZ3Object'])
);

vi.mock('./src/shared/stripeIntegration', async (importOriginal) =>
  wrapModule('src/shared/stripeIntegration', await importOriginal(), ['getStripeClient'])
);

vi.mock('./src/shared/postgrid', async (importOriginal) =>
  wrapModule('src/shared/postgrid', await importOriginal(), ['getPostGridLetter'])
);

vi.mock('./src/shared/chart-data', async (importOriginal) =>
  wrapModule('src/shared/chart-data', await importOriginal(), ['chartDataResourceHasMetaTagByCode'])
);

vi.mock('./src/shared/pdf/patient-payment-receipt-pdf', async (importOriginal) =>
  wrapModule('src/shared/pdf/patient-payment-receipt-pdf', await importOriginal(), ['createPatientPaymentReceiptPdf'])
);

vi.mock('./src/shared/pdf/visit-details-pdf/get-video-resources', async (importOriginal) =>
  wrapModule('src/shared/pdf/visit-details-pdf/get-video-resources', await importOriginal(), [
    'getAppointmentAndRelatedResources',
  ])
);

vi.mock('./src/shared/template-placeholders', async (importOriginal) =>
  wrapModule('src/shared/template-placeholders', await importOriginal(), [
    'resolveTemplatePlaceholders',
    'fillOutreachTemplate',
  ])
);

vi.mock('./src/shared/ai', async (importOriginal) =>
  wrapModule('src/shared/ai', await importOriginal(), [
    'invokeChatbotVertexAI',
    'transcribeAndCreateResourcesFromZ3Audio',
  ])
);

// ---------------------------------------------------------------------------------------
// Feature-area shared modules
// ---------------------------------------------------------------------------------------
vi.mock('./src/ehr/shared/harvest', async (importOriginal) =>
  wrapModule('src/ehr/shared/harvest', await importOriginal(), [
    'createMasterRecordPatchOperations',
    'createUpdatePharmacyPatchOps',
    'updatePatientAccountFromQuestionnaire',
    'getAccountAndCoverageResourcesForPatient',
    'createDocumentResources',
    'createConsentResources',
    'createErxContactOperation',
    'mergeEncounterAccounts',
    'makeEncounterAccountPatchOp',
  ])
);

vi.mock('./src/billing/shared', async (importOriginal) =>
  wrapModule('src/billing/shared', await importOriginal(), [
    'createBillingClient',
    'fetchClaimGraph',
    'resolvePayersByRef',
  ])
);

vi.mock('./src/billing/claim-amounts', async (importOriginal) =>
  wrapModule('src/billing/claim-amounts', await importOriginal(), [
    'fetchClaimResponsesByClaimIds',
    'fetchClaimEraLinks',
  ])
);

vi.mock('./src/billing/payments', async (importOriginal) =>
  wrapModule('src/billing/payments', await importOriginal(), ['recordBillingPatientPayment'])
);

vi.mock('./src/billing/search-billing-patient-ar-claims/handler', async (importOriginal) =>
  wrapModule('src/billing/search-billing-patient-ar-claims/handler', await importOriginal(), [
    'fetchAllActivePatientArClaims',
  ])
);

vi.mock('./src/subscriptions/helpers', async (importOriginal) =>
  wrapModule('src/subscriptions/helpers', await importOriginal(), ['patchTaskStatus'])
);

vi.mock('./src/subscriptions/task/validateRequestParameters', async (importOriginal) =>
  wrapModule('src/subscriptions/task/validateRequestParameters', await importOriginal(), ['validateRequestParameters'])
);

vi.mock('./src/subscriptions/task/helpers', async (importOriginal) =>
  wrapModule('src/subscriptions/task/helpers', await importOriginal(), ['wrapTaskHandler'])
);

vi.mock('./src/rcm/scheduled-outreach-config/helpers', async (importOriginal) =>
  wrapModule('src/rcm/scheduled-outreach-config/helpers', await importOriginal(), [
    'getOrCreateOutreachConfig',
    'parsePlanDefinitionToActions',
    'parseNotificationsTimeRestriction',
  ])
);

vi.mock('./src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks', async (importOriginal) =>
  wrapModule('src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks', await importOriginal(), [
    'produceOutreachTasks',
  ])
);

vi.mock('./src/rcm/invoice-config/helpers', async (importOriginal) =>
  wrapModule('src/rcm/invoice-config/helpers', await importOriginal(), [
    'getOrCreateInvoicingConfig',
    'parseInvoicingConfig',
  ])
);

vi.mock('./src/rcm/employers/candid-sync', async (importOriginal) =>
  wrapModule('src/rcm/employers/candid-sync', await importOriginal(), [
    'createCandidClientIfConfigured',
    'createCandidEmployerPayer',
    'updateCandidEmployerPayer',
    'toggleCandidEmployerPayer',
  ])
);
