import { loadStripe as _loadStripe } from '@stripe/stripe-js';

export async function loadStripe(key: string, stripeAccount?: string): ReturnType<typeof _loadStripe> {
  let err: Error | undefined;
  for (let i = 0; i < 3; i++) {
    try {
      return await _loadStripe(key, {
        stripeAccount,
      });
    } catch (error) {
      err = error as Error;
      console.error('Error loading Stripe:', error);
    }
  }
  if (err) {
    throw err;
  }
  throw new Error('Unknown error loading Stripe');
}
