import { loadStripe as _loadStripe } from '@stripe/stripe-js';
export async function loadStripe(key, stripeAccount) {
    let err;
    for (let i = 0; i < 3; i++) {
        try {
            return await _loadStripe(key, {
                stripeAccount,
            });
        }
        catch (error) {
            err = error;
            console.error('Error loading Stripe:', error);
        }
    }
    if (err) {
        throw err;
    }
    throw new Error('Unknown error loading Stripe');
}
//# sourceMappingURL=stripe.js.map