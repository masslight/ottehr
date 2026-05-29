import { afterEach, beforeEach, expect } from 'vitest';

// Shared guard for unit & component tests: they must be hermetic — no real network
// egress. A test that hits the network depends on an external server (none is
// running here), producing cryptic ECONNREFUSED noise and timing-dependent
// flakiness. We block `fetch` and fail loudly so the offending test gets a proper
// mock instead. Integration tests (which legitimately use the network) are exempt
// by file path.
const attemptedNetworkCalls: string[] = [];
const realFetch = globalThis.fetch;

const isIntegrationTest = (): boolean => {
  const testPath = expect.getState?.()?.testPath ?? '';
  return testPath.includes('/test/integration/') || testPath.includes('/tests/integration/');
};

globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  if (isIntegrationTest()) {
    return realFetch(input, init);
  }
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  attemptedNetworkCalls.push(url);
  return Promise.reject(new Error(`Blocked network call in test: ${url}`));
}) as typeof fetch;

beforeEach(() => {
  attemptedNetworkCalls.length = 0;
});

afterEach(() => {
  if (attemptedNetworkCalls.length > 0) {
    const urls = [...new Set(attemptedNetworkCalls)].join('\n  ');
    attemptedNetworkCalls.length = 0;
    throw new Error(
      `Test attempted real network call(s):\n  ${urls}\n` + `Mock the API hook/module so the test is hermetic.`
    );
  }
});
