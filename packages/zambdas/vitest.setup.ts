import { vi } from 'vitest';

// Mock @sentry/aws-serverless to avoid SSR import issues during tests
vi.mock('@sentry/aws-serverless', () => ({
  init: vi.fn(),
  isInitialized: vi.fn(() => false),
  setTag: vi.fn(),
  wrapHandler: vi.fn((handler) => handler), // Pass through the handler without modification
}));
