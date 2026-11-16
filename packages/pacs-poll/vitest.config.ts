import { defineConfig } from 'vitest/config';

// The shared no-network setup is deliberately not used here: these tests exercise network code against
// loopback servers they start themselves, which the setup's blanket `fetch` block would reject.
export default defineConfig({
  test: {
    silent: true,
    include: ['test/**/*.test.ts'],
  },
});
