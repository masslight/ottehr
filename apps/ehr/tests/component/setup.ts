import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { clearAllConfigOverrides } from '../test-utils/config-helpers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
  clearAllConfigOverrides();
});
