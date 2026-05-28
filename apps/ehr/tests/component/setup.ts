import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// Network egress is blocked by the shared no-network.setup.ts (wired in vitest.config).

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
