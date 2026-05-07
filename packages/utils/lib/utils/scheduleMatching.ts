// ─────────────────────────────────────────────────────────────────────────────
// Scheduling feasibility / assignment primitive
// ─────────────────────────────────────────────────────────────────────────────
//
// This file is intentionally framework-free: pure functions over pure data.
// Callers are responsible for assembling the inputs from FHIR (PRs, Schedules,
// Slots, Appointments) and converting back when persisting decisions. Keeping
// this module pure makes the spec scenarios from
//   apps/.../requirements/YourTime-Ideal-Scheduling.md (Examples 1–4)
// directly testable as fixtures and isolates the algorithm from the much
// noisier I/O layers around it.
//
// What this primitive answers
// ───────────────────────────
// Given:
//   • A set of bookings (existing + a candidate), each with a service, a time
//     window, and the qualified-and-working providers it could be assigned to;
//
// the primitive decides whether some assignment of providers to bookings
// exists such that no provider is assigned two overlapping bookings. Both
// callers — slot generation (yes/no) and assignment compute (who gets what) —
// use the same algorithm; the difference is whether they need the witness.
//
// Algorithm shape
// ───────────────
// At every "event point" in the candidate's window (any booking-start or
// booking-end inside it), the *active* booking set is constant. Run an
// augmenting-path bipartite match between active bookings (left) and their
// per-booking qualified-and-working providers (right). If every active set
// matches, the schedule is feasible. The hardest interval is sufficient in
// the common case, but checking each interval is robust against qualification
// asymmetries and cheap at clinic scale (≤30 bookings/day, ≤15 providers).
//
// V1 limitations (intentional, see below)
// ───────────────────────────────────────
// 1. **No retroactive rebalancing.** The primitive is used as a *picker* at
//    booking time: it produces one feasible assignment and that assignment is
//    stamped on Appointment.participant. Subsequent booking attempts treat
//    those stamps as fixed constraints rather than reshuffleable. Some
//    candidate times will be hidden as "unavailable" when they would be
//    feasible after a reshuffle (the requirements doc's Example 2 second
//    variation is exactly this case).
//
//    This is a deliberate v1 trade. The intended deployment is patient-self-
//    book, with no staff in the loop to interpret a booking failure and
//    trigger a rebalance — so a "would you like to rebalance?" UX has no
//    natural home. False negatives surface to the patient as "10am isn't
//    available; pick another time," a small reshuffle rather than a lost
//    booking. Avoiding the limitation requires deferred stamping for
//    anonymous bookings, which expands the surface area to every consumer of
//    Encounter.participant[ATND]. v2 can layer in silent rebalance during
//    slot generation — strictly additive, no migration needed.
//
//    Conditions that warrant revisiting:
//      • Logged "would-be feasible after reshuffle" rate exceeds the noise
//        floor in production. The primitive is well-positioned to produce
//        this signal — every infeasibility check can also report whether
//        relaxing the existing-stamps constraint would have succeeded.
//      • A deployment with dense overlapping qualifications (multi-ARNP
//        practice with shared service mixes) where false negatives compound.
//
// 2. **Encounter stamping is deferred to check-in for anonymous bookings.**
//    The Appointment carries the tentative provider; the Encounter, which
//    represents the actual interaction, only gets participant[ATND] when the
//    visit starts (default to Appointment's tentative provider; the front
//    desk can override). For named bookings the patient picked the provider,
//    so both Appointment and Encounter are stamped at booking as today.
//
// 3. **Cross-PR busy aggregation is required upstream.** The primitive's
//    `workingWindows` input must reflect a practitioner's full busy set
//    across all of their PR-actored Schedules. See
//    getPractitionerSchedulePeerIds in scheduleUtils.ts.

/** Half-open time interval [startMs, endMs). */
export interface TimeInterval {
  startMs: number;
  endMs: number;
}

export interface BookingInput {
  /** Stable identifier (e.g. Appointment.id, or 'candidate' for the proposed slot). */
  id: string;
  /** Service category id; matched against `qualifications`. */
  serviceId: string;
  window: TimeInterval;
}

export interface ProviderWorkingWindow {
  providerId: string;
  /** Intervals during which this provider is working AND not otherwise busy. */
  freeIntervals: TimeInterval[];
}

export interface MatchingInput {
  /** All bookings under consideration, including the candidate. */
  bookings: BookingInput[];
  /** Provider ids in scope for the day at the relevant location. */
  providers: string[];
  /** Map: serviceId → set of providerIds qualified for that service. */
  qualifications: Map<string, Set<string>>;
  /** Map: providerId → free-interval list (working hours minus busy). */
  workingWindows: Map<string, ProviderWorkingWindow>;
}

export interface MatchingResult {
  feasible: boolean;
  /** When feasible, a witnessing assignment of bookingId → providerId. */
  assignment?: Map<string, string>;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Decide whether all bookings can be assigned to qualified providers without
 * any provider being scheduled into two overlapping intervals. Returns one
 * witnessing assignment if so.
 *
 * Pure — no I/O, no global state. Same inputs always produce the same answer.
 */
export function canScheduleAllBookings(input: MatchingInput): MatchingResult {
  const { bookings, providers, qualifications, workingWindows } = input;

  if (bookings.length === 0) return { feasible: true, assignment: new Map() };

  // For each booking, the candidate set is providers who are qualified AND
  // free for the booking's full window. Empty set ⇒ infeasible immediately.
  const candidatesFor = new Map<string, string[]>();
  for (const b of bookings) {
    const qualified = qualifications.get(b.serviceId) ?? new Set();
    const candidates: string[] = [];
    for (const p of providers) {
      if (!qualified.has(p)) continue;
      const ww = workingWindows.get(p);
      if (!ww) continue;
      if (intervalCoveredByFreeIntervals(b.window, ww.freeIntervals)) {
        candidates.push(p);
      }
    }
    if (candidates.length === 0) return { feasible: false };
    candidatesFor.set(b.id, candidates);
  }

  // Walk the day's event points (every distinct start/end among bookings).
  // Between consecutive points the active set is constant; matching each
  // active set is sufficient because providers can't double-book inside an
  // active interval but ARE free to take separate bookings outside it.
  const events = collectEventPoints(bookings);

  for (let i = 0; i < events.length - 1; i++) {
    const intervalStart = events[i];
    const intervalEnd = events[i + 1];
    if (intervalStart === intervalEnd) continue;
    const active = bookings.filter((b) => b.window.startMs < intervalEnd && b.window.endMs > intervalStart);
    if (active.length === 0) continue;
    const matched = bipartiteMatch(active, candidatesFor);
    if (!matched) return { feasible: false };
  }

  // We've shown each interval is independently coverable. Build a stable
  // day-level assignment by matching the busiest interval and extending.
  const assignment = pickWitnessAssignment(bookings, candidatesFor);
  if (!assignment) return { feasible: false };
  return { feasible: true, assignment };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function intervalCoveredByFreeIntervals(needle: TimeInterval, hay: TimeInterval[]): boolean {
  // A booking's window must lie entirely inside one free interval. Splitting
  // a single booking across two free intervals isn't permitted — the provider
  // is needed continuously for the booking's duration.
  for (const h of hay) {
    if (h.startMs <= needle.startMs && h.endMs >= needle.endMs) return true;
  }
  return false;
}

function collectEventPoints(bookings: BookingInput[]): number[] {
  const points = new Set<number>();
  for (const b of bookings) {
    points.add(b.window.startMs);
    points.add(b.window.endMs);
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * Standard augmenting-path bipartite matching. Returns assignment when every
 * left node (booking) is matched to a distinct right node (provider).
 */
function bipartiteMatch(
  bookings: BookingInput[],
  candidatesFor: Map<string, string[]>
): Map<string, string> | undefined {
  const matchOfProvider = new Map<string, string>(); // providerId → bookingId
  for (const booking of bookings) {
    const visited = new Set<string>();
    if (!tryAugment(booking.id, candidatesFor, matchOfProvider, visited)) {
      return undefined;
    }
  }
  // Invert the result so the caller sees bookingId → providerId.
  const out = new Map<string, string>();
  for (const [provider, booking] of matchOfProvider) out.set(booking, provider);
  return out;
}

function tryAugment(
  bookingId: string,
  candidatesFor: Map<string, string[]>,
  matchOfProvider: Map<string, string>,
  visited: Set<string>
): boolean {
  for (const provider of candidatesFor.get(bookingId) ?? []) {
    if (visited.has(provider)) continue;
    visited.add(provider);
    const incumbent = matchOfProvider.get(provider);
    if (incumbent === undefined || tryAugment(incumbent, candidatesFor, matchOfProvider, visited)) {
      matchOfProvider.set(provider, bookingId);
      return true;
    }
  }
  return false;
}

/**
 * Build a witnessing assignment for the full day by matching against the
 * union of constraints (every interval simultaneously). If each interval was
 * individually coverable, this combined matching almost always succeeds; if
 * it doesn't, the primitive returns undefined and the caller treats the day
 * as infeasible.
 *
 * Approach: model each booking's "exclusion neighbors" (other bookings whose
 * windows overlap) implicitly by using the same provider-match map across the
 * day. Augmenting paths re-route incumbents whose intervals don't conflict
 * with the new booking — but a provider can hold two bookings only if their
 * windows are disjoint. We enforce disjointness by keying each provider's
 * matches by interval.
 */
function pickWitnessAssignment(
  bookings: BookingInput[],
  candidatesFor: Map<string, string[]>
): Map<string, string> | undefined {
  // providerId → list of (bookingId, window) currently assigned to them.
  const heldByProvider = new Map<string, { bookingId: string; window: TimeInterval }[]>();
  const visitedThisAugment = new Set<string>();

  const conflicts = (window: TimeInterval, held: { window: TimeInterval }[]): boolean => {
    return held.some((h) => h.window.startMs < window.endMs && h.window.endMs > window.startMs);
  };

  const assign = (bookingId: string, window: TimeInterval): boolean => {
    for (const provider of candidatesFor.get(bookingId) ?? []) {
      if (visitedThisAugment.has(provider)) continue;
      visitedThisAugment.add(provider);
      const held = heldByProvider.get(provider) ?? [];
      if (!conflicts(window, held)) {
        held.push({ bookingId, window });
        heldByProvider.set(provider, held);
        return true;
      }
      // Try to re-route a conflicting incumbent.
      for (let i = 0; i < held.length; i++) {
        const incumbent = held[i];
        if (incumbent.window.startMs < window.endMs && incumbent.window.endMs > window.startMs) {
          // Tentatively remove incumbent and try to re-place it.
          const remainder = held.slice(0, i).concat(held.slice(i + 1));
          heldByProvider.set(provider, remainder);
          if (assign(incumbent.bookingId, incumbent.window)) {
            const updated = heldByProvider.get(provider) ?? [];
            updated.push({ bookingId, window });
            heldByProvider.set(provider, updated);
            return true;
          }
          // Undo.
          heldByProvider.set(provider, held);
        }
      }
    }
    return false;
  };

  // Try the bookings in order of fewest candidates first — improves the odds
  // of the greedy phase succeeding before augmentation is needed.
  const sorted = [...bookings].sort(
    (a, b) => (candidatesFor.get(a.id)?.length ?? 0) - (candidatesFor.get(b.id)?.length ?? 0)
  );
  for (const b of sorted) {
    visitedThisAugment.clear();
    if (!assign(b.id, b.window)) return undefined;
  }

  const out = new Map<string, string>();
  for (const [provider, held] of heldByProvider) {
    for (const h of held) out.set(h.bookingId, provider);
  }
  return out;
}
