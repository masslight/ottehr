import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';

expect.extend(matchers);

// Importing Stripe.js injects its script tag, which happy-dom refuses to load. Tests that render
// the paperwork tree import it through the credit card input without ever loading Stripe.
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(async () => null) }));

afterEach(() => {
  cleanup();
});
