// Stands in for packages/zambdas/src/billing/shared.ts.
import Oystehr from '@oystehr/sdk';

declare const billingScope: unique symbol;

export interface BillingOystehr extends Oystehr {
  readonly [billingScope]: true;
}

declare const unscopedScope: unique symbol;

export interface UnscopedOystehr extends Oystehr {
  readonly [unscopedScope]: true;
}

export function createBillingClient(): BillingOystehr {
  return new Oystehr({}) as BillingOystehr;
}

export function createUnscopedClient(): UnscopedOystehr {
  return new Oystehr({}) as UnscopedOystehr;
}

// A helper whose client's type doesn't say what it can see.
export function createClient(): Oystehr {
  return new Oystehr({});
}
