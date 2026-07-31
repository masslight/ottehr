// Re-export the shared helper. The previous local implementation inspected only
// `extension[0]`, which is order-dependent (and would throw on an empty extension
// array) — it breaks outright once a Location carries multiple location-form
// codings (e.g. both virtual and in-person).
export { isLocationVirtual } from 'utils';
