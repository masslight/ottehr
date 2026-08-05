# Virtual scheduling northstar — provider-owned credentialing & the HS-pool model

**Status:** Draft · **Author:** imbenham · **Last updated:** 2026-08-03

> This is **forward-looking design — not part of PR `issue/otr-3008`** (see the companion
> [`self-service-scheduling.md`](./self-service-scheduling.md) for what that PR does). It's
> the open conversation about how **virtual (telehealth) scheduling** should work once the
> resources supporting the booking flow must be **configured by customers themselves** —
> i.e., in the self-service world that PR's Part I creates. Tentative; nothing here is built.

## The problem: capability & jurisdiction live on the wrong resource

Today a provider's *service-mode capability* (in-person vs telemed) and *jurisdiction*
(which state they can serve) are proxied through **Location** resources rather than owned by
the provider — most starkly for telemed, where jurisdiction is enforced only at booking via
a virtual Location's state and never checked against the provider who takes the encounter.
The target is to make capability and jurisdiction **provider facts** that can be enforced.

## How it works today (grounded in the code)

- **In-person** is already provider-shaped: a PractitionerRole binds a provider to a
  physical Location, so the provider is present at scheduling time.
- **Telemed is Location-shaped.** There is one virtual Location per state; the patient
  picks a state → its virtual Location → books a Slot on that Location's Schedule
  (`serviceModality: virtual`), with **no provider involved**
  (`StartVirtualVisit.tsx`, `create-appointment`). The virtual Location's `address.state`
  **is** the jurisdiction — telemed Locations are looked up by state
  (`getTelemedLocation`), and there is no other jurisdictional gate. `location.ts`
  self-documents this as the intended migration point to "a provider-credentialing model."
- **Provider licensure exists as data but isn't enforced.** Licenses are modeled as
  `Practitioner.qualification` entries with `whereValid` (the state)
  (`makeQualificationForPractitioner`), surfaced in the employee admin UI. But their only
  enforcement use is a **client-side** gate: the "Connect to Patient" button is hidden
  unless `isPractitionerLicensedInState` (`VirtualAppointmentFooter.tsx`). The backend
  does **not** check it — `assign-practitioner` patches the Encounter participant with a
  standing **TODO** where the licensure check belongs (`assign-practitioner/index.ts:45`).
  A provider not licensed in the appointment's state is not stopped server-side.

**Net:** jurisdiction is enforced only at booking, via the Location's state; provider
licensure is data + a soft UI hint, with a self-flagged gap where real enforcement should
live.

## The core tension

In-person credentialing maps cleanly onto a provider-owned model because a provider is
chosen at scheduling time. **Telemed has no provider at booking** — a pool of providers
takes encounters later — so "check the provider's jurisdiction at booking" has nothing to
check. Any provider-owned model has to answer where telemed jurisdiction is captured and
where it's enforced.

## Two tracks, very different risk

The northstar splits into two tracks that share the same credentialing validation but sit
at opposite ends of the risk spectrum.

### Track A — credentialing enforcement, audit-first (near-term)

The gap with real stakes: nothing server-side verifies a telemed provider is licensed in
the patient's jurisdiction. Assignment does no check (the `assign-practitioner` TODO), and
the only guard is a client-side, default-block button gate that enforces nothing at the
API. Closing this is **independent of the availability model** — it reads the appointment's
jurisdiction (`location.address.state`, unchanged) and the provider's
`qualification.whereValid`, and validates at assign/connect.

But enforcement is only safe if providers actually hold credentials — and that isn't
guaranteed. Provisioning validates a license's fields but doesn't require a provider to
have one, so a strict check could reject legitimate assignments and break telemed. So
Track A ships **audit-first**:

1. Add the check at assign/connect in **log-only mode** — loudly flag a would-be-rejection
   (provider lacks a credential for the appointment's state) without blocking.
2. Measure the would-be-rejection rate in production — or run a one-off query: of providers
   who take telemed encounters, what share carry `qualification.whereValid` covering the
   state?
3. Flip to hard enforcement only once coverage is sufficient; otherwise backfill credentials
   / require them at onboarding first.

This turns "enforcement might break telemed" into "measure exactly how much it would break
before it can break anything." The check it builds is the same validation Track B formalizes.

### Track B — provider-owned availability & the HS-pool target (deferred)

Re-homing telehealth availability off the per-state Locations is the big, production-risky
shift, deliberately out of near-term scope (many projects run telemed on the
Location-owns-the-schedule model today). The shape worth naming as the target is
**telehealth as a HealthcareService pool — the group pattern generalized**: an HS owns the
schedule, its member Locations are the supported jurisdictions, its member PractitionerRoles
are the provider pool, and assignment validates pool-membership **and** jurisdiction
credential. (HS-as-schedule-owner was dropped in the group-scheduling refactor — for scope,
not because it failed; worth git-confirming before reviving it.)

## Cliffhanger: where should telehealth availability live?

Whether the HS-pool target is actually *better* hinges on an unresolved product question —
and it's a self-service-configuration question as much as a data-model one:

> **One schedule per jurisdiction, or one schedule per service?**
>
> The current N-Locations model buys real flexibility: availability can differ per state
> (telehealth 9–5 in NJ, 10–6 in CA) — at the cost of configuring N schedules. An HS-owned
> single schedule is far easier to configure (one schedule for the whole telehealth service)
> but forces the *same* availability across every jurisdiction.
>
> If per-jurisdiction availability variation is a feature customers want, the N-schedule
> model earns its complexity and HS-owns-schedule is the wrong trade. If a single
> service-wide schedule is acceptable, HS-owns-schedule is clearly cleaner. **This is the
> decision that picks the model.**

## Remaining open questions

- **Availability vs. jurisdiction match**: a free slot on a pooled schedule doesn't
  guarantee a provider licensed in *this* patient's state is available. (No worse than
  today, which checks nothing — but the pool model should decide how it's handled.)
- **Service-mode capability** (in-person vs telemed) as a provider fact — representation and
  interaction with the pool.
- **Migration** off the virtual-Location-per-state proxy without breaking existing telemed
  booking.
- The EHR-vs-patient **booking-availability gap** (the shared serviceModes/visitTypes tag set
  gating both apps).

## Phasing (relative to the PR)

- **Track A — near-term, follows the PR.** Audit-first credentialing enforcement: add the
  assign/connect check in log-only mode, measure credential coverage, then enforce. Keeps
  the current Location-owns-the-schedule telemed model untouched.
- **Track B — deferred.** The HS-pool target, gated on the schedule-ownership
  [cliffhanger](#cliffhanger-where-should-telehealth-availability-live); retire the
  per-state Location proxy only once the provider-owned model is enforced.
