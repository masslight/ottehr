import { BillingOystehr, UnscopedOystehr } from '../../src/billing/shared';
import { ClinicalOystehr } from '../../src/shared/helpers';

// An Oystehr test double, which stands in for a client of any scope: the scope types keep billing code
// to the clients it may use, and a unit test can hand one mock to code that takes several.
export type OystehrMock = BillingOystehr & ClinicalOystehr & UnscopedOystehr;
