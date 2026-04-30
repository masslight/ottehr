import { vi } from 'vitest';

// Mock @sentry/aws-serverless to avoid SSR import issues during tests
vi.mock('@sentry/aws-serverless', () => ({
  init: vi.fn(),
  isInitialized: vi.fn(() => false),
  setTag: vi.fn(),
  setTags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb: (scope: { setTag: (k: string, v: unknown) => void }) => void) => cb({ setTag: vi.fn() })),
  wrapHandler: vi.fn((handler) => handler), // Pass through the handler without modification
}));
