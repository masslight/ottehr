import { vi } from 'vitest';

// Stub the Sentry SDK so no test starts a real client. The scope, trace and span helpers just run
// their callbacks, so shared/sentry.ts's wrapHandler runs its body unchanged.
vi.mock('@sentry/node-core/light', () => ({
  init: vi.fn(),
  isInitialized: vi.fn(() => false),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  flush: vi.fn(async () => true),
  withScope: vi.fn((cb: (scope: { setTag: (k: string, v: unknown) => void }) => void) => cb({ setTag: vi.fn() })),
  withIsolationScope: vi.fn((cb: () => unknown) => cb()),
  continueTrace: vi.fn((_traceHeaders: unknown, cb: () => unknown) => cb()),
  startSpan: vi.fn((_options: unknown, cb: () => unknown) => cb()),
}));
