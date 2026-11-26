// Own module: encounters.ts imports billing.ts, so billing.ts importing this from encounters.ts would be a cycle.
import { PaymentVariant } from '../../../fhir/encounter';

export const PAYMENT_VARIANT_VALUES = Object.values(PaymentVariant) as [PaymentVariant, ...PaymentVariant[]];
