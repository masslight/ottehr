import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { ReactNode, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookableSelect, { BookableMode, BookableTarget } from '../../src/components/BookableSelect';

// Fixture cluster covers the filter dimensions we care about:
//   - locInPersonUC: in-person Location whose Schedule explicitly supports
//     urgent-care (positive case for serviceCategoryCode filter)
//   - locInPersonMassage: in-person Location whose Schedule supports
//     massage only (excluded when serviceCategoryCode='urgent-care')
//   - locInPersonNoCat: in-person Location whose Schedule carries NO
//     serviceCategory codings (back-compat — admitted regardless of code)
//   - locVirtual: virtual Location (excluded by mode filter when IN_PERSON
//     is the only requested mode)
//   - group, role: exercise the resourceTypes filter
const SLUG_SYSTEM = 'https://fhir.ottehr.com/r4/slug';

const makeLocation = (id: string, name: string, slug: string, opts: { virtual?: boolean } = {}): Location => ({
  resourceType: 'Location',
  id,
  name,
  identifier: [{ system: SLUG_SYSTEM, value: slug }],
  // Mirror the virtual-Location shape isLocationVirtual checks for —
  // extension with `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`
  // and valueCoding.code === 'vi'. Without this exact shape the helper
  // returns false and the mode filter under test never engages.
  ...(opts.virtual
    ? {
        extension: [
          {
            url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
            valueCoding: { system: 'http://terminology.hl7.org/CodeSystem/location-form', code: 'vi' },
          },
        ],
      }
    : {}),
});

const makeSchedule = (id: string, locationId: string, serviceCategoryCodes?: string[]): Schedule => ({
  resourceType: 'Schedule',
  id,
  actor: [{ reference: `Location/${locationId}` }],
  ...(serviceCategoryCodes
    ? {
        serviceCategory: serviceCategoryCodes.map((code) => ({
          coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/service-category', code }],
        })),
      }
    : {}),
});

const locInPersonUC = makeLocation('loc-uc', 'NY Urgent Care', 'ny-uc');
const schedInPersonUC = makeSchedule('sched-uc', 'loc-uc', ['urgent-care']);
const locInPersonMassage = makeLocation('loc-massage', 'Massage Studio', 'massage-studio');
const schedInPersonMassage = makeSchedule('sched-massage', 'loc-massage', ['massage']);
const locInPersonNoCat = makeLocation('loc-nocat', 'Legacy Clinic', 'legacy-clinic');
const schedInPersonNoCat = makeSchedule('sched-nocat', 'loc-nocat'); // no serviceCategory at all
// Schedule.serviceCategory carries only a service-mode marker (the
// SlotServiceCategory.inPersonServiceMode shape used by patient flow code).
// The filter must ignore non-SERVICE_CATEGORY_SYSTEM codings — otherwise a
// schedule like this looks "restricted to non-matching codes" and gets
// silently excluded for every real service-category lookup.
const locInPersonModeOnly = makeLocation('loc-mode-only', 'Mode-Only Clinic', 'mode-only-clinic');
const schedInPersonModeOnly: Schedule = {
  resourceType: 'Schedule',
  id: 'sched-mode-only',
  actor: [{ reference: 'Location/loc-mode-only' }],
  serviceCategory: [
    {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/service-category', code: 'in-person' }],
    },
  ],
};
const locVirtual = makeLocation('loc-virtual', 'Telemed NYC', 'telemed-nyc', { virtual: true });
const schedVirtual = makeSchedule('sched-virtual', 'loc-virtual', ['urgent-care']);

// Group-only-at-Location case: Location's own Schedule is for a different
// category, but a Group attached via HS.location[] has a member PR whose
// PR-Schedule supports the target category. Pre-resolver behavior would
// have dropped this Location entirely from a urgent-care query; the
// per-Location resolver admits it via the Group tier.
const locGroupOnly = makeLocation('loc-group-only', 'Group-Only Clinic', 'group-only-clinic');
const schedGroupOnlyOwn = makeSchedule('sched-group-only-own', 'loc-group-only', ['occupational-medicine']);
const groupAtLocGroupOnly: HealthcareService = {
  resourceType: 'HealthcareService',
  id: 'hs-group-only',
  name: 'Urgent Care Group',
  identifier: [{ system: SLUG_SYSTEM, value: 'urgent-care-group' }],
  // Anchors the Group to locGroupOnly so the inventory builder buckets it
  // under that Location.
  location: [{ reference: 'Location/loc-group-only' }],
};

// PR-only-at-Location case: own Schedule restricted to a different
// category, no Group at this Location, and a PR with location[] pointing
// here whose PR-Schedule supports the target category. Resolver admits at
// the PR tier with the provider's name as the typeSuffix.
const locPrOnly = makeLocation('loc-pr-only', 'PR-Only Clinic', 'pr-only-clinic');
const schedPrOnlyOwn = makeSchedule('sched-pr-only-own', 'loc-pr-only', ['urgent-care']);
const practitionerAtPrOnly: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-acu',
  name: [{ given: ['Acu'], family: 'Provider' }],
};
const prAtPrOnly: PractitionerRole = {
  resourceType: 'PractitionerRole',
  id: 'pr-acu',
  identifier: [{ system: SLUG_SYSTEM, value: 'acu-provider' }],
  practitioner: { reference: 'Practitioner/prac-acu' },
  location: [{ reference: 'Location/loc-pr-only' }],
  // For FHIR-backed categories, PR opt-in lives on healthcareService[]
  // (the authoritative `practitionerRoleOffersCategory` check), NOT on the
  // PR-Schedule's serviceCategory. The picker resolver consults this list.
  healthcareService: [{ reference: 'HealthcareService/cat-acupuncture' }],
};
const prScheduleAtPrOnly: Schedule = {
  resourceType: 'Schedule',
  id: 'sched-pr-acu',
  actor: [{ reference: 'PractitionerRole/pr-acu' }],
};

// Ambiguous case: two Groups at the same Location both supporting the
// category. Resolver should surface both as sub-options under the Location
// rather than silently pick one.
const locAmbiguous = makeLocation('loc-ambig', 'Ambiguous Clinic', 'ambiguous-clinic');
const schedAmbigOwn = makeSchedule('sched-ambig-own', 'loc-ambig', ['urgent-care']);
const groupAmbigStd: HealthcareService = {
  resourceType: 'HealthcareService',
  id: 'hs-ambig-std',
  name: 'Acupuncture Standard',
  identifier: [{ system: SLUG_SYSTEM, value: 'acu-std' }],
  location: [{ reference: 'Location/loc-ambig' }],
};
const groupAmbigPrem: HealthcareService = {
  resourceType: 'HealthcareService',
  id: 'hs-ambig-prem',
  name: 'Acupuncture Premium',
  identifier: [{ system: SLUG_SYSTEM, value: 'acu-prem' }],
  location: [{ reference: 'Location/loc-ambig' }],
};
const prAmbigShared: PractitionerRole = {
  resourceType: 'PractitionerRole',
  id: 'pr-ambig',
  identifier: [{ system: SLUG_SYSTEM, value: 'ambig-pr' }],
  // PR at locAmbig is a member of both Groups via the location-overlap
  // rule (PR.location intersects Group.location). The PR opts into the
  // acupuncture category via healthcareService[], so both Groups admit
  // through `practitionerRoleOffersCategory`.
  location: [{ reference: 'Location/loc-ambig' }],
  healthcareService: [{ reference: 'HealthcareService/cat-acupuncture' }],
};
const prScheduleAmbigShared: Schedule = {
  resourceType: 'Schedule',
  id: 'sched-pr-ambig',
  actor: [{ reference: 'PractitionerRole/pr-ambig' }],
};

// PR member of the Group-only Location's Group, with a PR-Schedule for
// urgent-care so the Group qualifies (the resolver checks members'
// schedules to validate Group category support).
const practitionerForGroup: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-group-mem',
  name: [{ given: ['Group'], family: 'Member' }],
};
const prGroupMember: PractitionerRole = {
  resourceType: 'PractitionerRole',
  id: 'pr-group-mem',
  identifier: [{ system: SLUG_SYSTEM, value: 'group-mem' }],
  practitioner: { reference: 'Practitioner/prac-group-mem' },
  location: [{ reference: 'Location/loc-group-only' }],
  // For the Group-only case: the test queries for a FHIR-backed category
  // ('reflexology' below — non-BOOKING_CONFIG). The Group admits because
  // this PR member opts into the category via healthcareService[].
  healthcareService: [{ reference: 'HealthcareService/cat-reflexology' }],
};
const prScheduleGroupMember: Schedule = {
  resourceType: 'Schedule',
  id: 'sched-pr-group-mem',
  actor: [{ reference: 'PractitionerRole/pr-group-mem' }],
};
// Location with multiple Schedules — exercise the "any Schedule supports
// the picked category" rule. The first Schedule covers occupational
// medicine only; the second covers urgent-care. The pre-fix code took
// `schedules.find(...)` which returns the FIRST attached Schedule and would
// have excluded this Location for an urgent-care query even though it does
// offer the service via its second Schedule. This is the shape that
// surfaced as "New York missing from the picker" in the e2e env.
const locMultiSched = makeLocation('loc-multi', 'Multi Service Clinic', 'multi-service');
const schedMultiOcc = makeSchedule('sched-multi-occ', 'loc-multi', ['occupational-medicine']);
const schedMultiUC = makeSchedule('sched-multi-uc', 'loc-multi', ['urgent-care']);

const group: HealthcareService = {
  resourceType: 'HealthcareService',
  id: 'hs-1',
  name: 'NYC Group',
  identifier: [{ system: SLUG_SYSTEM, value: 'nyc-group' }],
};

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'pr-practitioner',
  name: [{ given: ['Ada'], family: 'Lovelace' }],
};
const role: PractitionerRole = {
  resourceType: 'PractitionerRole',
  id: 'pr-role',
  identifier: [{ system: SLUG_SYSTEM, value: 'ada-lovelace' }],
  practitioner: { reference: 'Practitioner/pr-practitioner' },
};

// Resource-type-routed mock. Each call to oystehr.fhir.search receives the
// search params; we dispatch on resourceType and return the matching fixture
// set. Unbundle returns a flat resource list (matches what getAllFhirSearchPages
// consumes via `.unbundle()`).
const mockSearch = vi.fn((params: { resourceType: string }) => {
  let resources: unknown[] = [];
  if (params.resourceType === 'Location') {
    resources = [
      locInPersonUC,
      schedInPersonUC,
      locInPersonMassage,
      schedInPersonMassage,
      locInPersonNoCat,
      schedInPersonNoCat,
      locInPersonModeOnly,
      schedInPersonModeOnly,
      locMultiSched,
      schedMultiOcc,
      schedMultiUC,
      locVirtual,
      schedVirtual,
      // New fixtures for the Group/PR-at-Location aggregation tests.
      locGroupOnly,
      schedGroupOnlyOwn,
      locPrOnly,
      schedPrOnlyOwn,
      locAmbiguous,
      schedAmbigOwn,
    ];
  } else if (params.resourceType === 'HealthcareService') {
    resources = [group, groupAtLocGroupOnly, groupAmbigStd, groupAmbigPrem];
  } else if (params.resourceType === 'PractitionerRole') {
    // The PR query now revincludes Schedules — mock returns both the PR
    // bundle entries (PR + Practitioner + Location includes) AND their
    // actored Schedules. The resolver partitions them out by actor type.
    resources = [
      role,
      practitioner,
      prAtPrOnly,
      practitionerAtPrOnly,
      prScheduleAtPrOnly,
      prAmbigShared,
      prScheduleAmbigShared,
      prGroupMember,
      practitionerForGroup,
      prScheduleGroupMember,
    ];
  }
  return Promise.resolve({
    entry: resources.map((r) => ({ resource: r, search: { mode: 'match' } })),
    total: resources.length,
    unbundle: () => resources,
  });
});

const mockOystehr = { fhir: { search: mockSearch } };
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: mockOystehr, oystehrZambda: null }),
}));

const TestProviders = ({ children }: { children: ReactNode }): JSX.Element => <BrowserRouter>{children}</BrowserRouter>;

interface HarnessProps {
  mode?: BookableMode[];
  resourceTypes?: ('Location' | 'HealthcareService' | 'PractitionerRole')[];
  serviceCategoryCode?: string;
  serviceCategoryFhirId?: string;
  initialSelected?: BookableTarget;
  onSelectedChange?: (t: BookableTarget | undefined) => void;
}

// Stateful harness so the auto-clear-on-stale-selection effect can write
// back through `setSelected`. The parent owns the state and forwards
// changes to `onSelectedChange` so individual tests can assert on the
// final value.
const Harness = ({
  mode,
  resourceTypes,
  serviceCategoryCode,
  serviceCategoryFhirId,
  initialSelected,
  onSelectedChange,
}: HarnessProps): JSX.Element => {
  const [selected, setSelected] = useState<BookableTarget | undefined>(initialSelected);
  return (
    <TestProviders>
      <BookableSelect
        selected={selected}
        setSelected={(t) => {
          setSelected(t);
          onSelectedChange?.(t);
        }}
        mode={mode}
        resourceTypes={resourceTypes}
        serviceCategoryCode={serviceCategoryCode}
        serviceCategoryFhirId={serviceCategoryFhirId}
      />
    </TestProviders>
  );
};

const openDropdown = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const combobox = await screen.findByRole('combobox');
  await user.click(combobox);
};

const getOptionTexts = async (): Promise<string[]> => {
  const listbox = await screen.findByRole('listbox');
  return Array.from(listbox.querySelectorAll('li')).map((li) => li.textContent ?? '');
};

describe('BookableSelect — filter props', () => {
  beforeEach(() => {
    mockSearch.mockClear();
  });

  it('default (no resourceTypes) shows all three target types', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // Locations + groups + PRs all present; the chips render as text suffix.
    expect(texts.some((t) => t.includes('NY Urgent Care'))).toBe(true);
    expect(texts.some((t) => t.includes('NYC Group'))).toBe(true);
    expect(texts.some((t) => t.includes('Ada Lovelace'))).toBe(true);
  });

  it("resourceTypes=['Location'] hides Groups and PR-direct schedules", async () => {
    const user = userEvent.setup();
    render(<Harness resourceTypes={['Location']} />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    expect(texts.some((t) => t.includes('NYC Group'))).toBe(false);
    expect(texts.some((t) => t.includes('Ada Lovelace'))).toBe(false);
    expect(texts.some((t) => t.includes('NY Urgent Care'))).toBe(true);
  });

  it('serviceCategoryCode filter excludes Locations whose Schedule does not list the code', async () => {
    const user = userEvent.setup();
    render(<Harness resourceTypes={['Location']} serviceCategoryCode="urgent-care" />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // Excluded: massage Schedule has codings but doesn't include urgent-care.
    expect(texts.some((t) => t.includes('Massage Studio'))).toBe(false);
    // Included: explicit urgent-care match.
    expect(texts.some((t) => t.includes('NY Urgent Care'))).toBe(true);
  });

  it('serviceCategoryCode filter admits Locations whose Schedule has no serviceCategory (back-compat)', async () => {
    const user = userEvent.setup();
    render(<Harness resourceTypes={['Location']} serviceCategoryCode="urgent-care" />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // Schedule with no serviceCategory codings is treated as "supports all"
    // so the back-compat rule keeps pre-tagging Schedules visible regardless
    // of the requested code. Without this rule any never-tagged Schedule
    // would silently vanish from the picker the moment a category is set.
    expect(texts.some((t) => t.includes('Legacy Clinic'))).toBe(true);
  });

  it('serviceCategoryCode filter admits a Location whose later Schedule (not the first) supports the picked code', async () => {
    const user = userEvent.setup();
    render(<Harness resourceTypes={['Location']} serviceCategoryCode="urgent-care" />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // The pre-fix bug shape: only the first Schedule attached to a Location
    // was consulted. A Location with [occupational-medicine, urgent-care]
    // Schedules would surface only the occ-med one and get excluded for an
    // urgent-care query. The post-fix code unions across all attached
    // Schedules — if any supports the code, the Location qualifies.
    expect(texts.some((t) => t.includes('Multi Service Clinic'))).toBe(true);
  });

  it('serviceCategoryCode filter admits Schedules whose only codings are non-service-category (mode markers)', async () => {
    const user = userEvent.setup();
    render(<Harness resourceTypes={['Location']} serviceCategoryCode="urgent-care" />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // The pre-fix bug: collecting all codings regardless of system meant a
    // Schedule with only mode markers reported `codes.length > 0` and got
    // rejected for not including 'urgent-care'. The system-scoped filter
    // restores the back-compat rule by ignoring foreign-system codings —
    // a Schedule with no SERVICE_CATEGORY_SYSTEM codings is "unrestricted".
    expect(texts.some((t) => t.includes('Mode-Only Clinic'))).toBe(true);
  });

  it('mode filter still excludes virtual Locations under IN_PERSON, even when their Schedule lists the code', async () => {
    const user = userEvent.setup();
    render(<Harness mode={[BookableMode.IN_PERSON]} resourceTypes={['Location']} serviceCategoryCode="urgent-care" />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // Telemed NYC's Schedule does list urgent-care, but it's a virtual
    // Location — the mode filter rejects it before the category check, so
    // category support alone can't override a mode mismatch.
    expect(texts.some((t) => t.includes('Telemed NYC'))).toBe(false);
  });

  it('surfaces a Location whose only (FHIR) reflexology availability comes via a Group at that Location', async () => {
    const user = userEvent.setup();
    render(
      <Harness resourceTypes={['Location']} serviceCategoryCode="reflexology" serviceCategoryFhirId="cat-reflexology" />
    );

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // Group-Only Clinic's own Schedule covers occupational-medicine (not
    // reflexology). The Group at the Location has a member PR whose
    // healthcareService[] back-refs `cat-reflexology` — that's the
    // authoritative `practitionerRoleOffersCategory` opt-in. Under strict
    // FHIR rules the Group tier admits this Location. One target at the
    // winning tier ⇒ silent pick, bare Location name.
    const hits = texts.filter((t) => t.includes('Group-Only Clinic'));
    expect(hits).toHaveLength(1);
    expect(hits[0]).not.toContain('(');
  });

  it('surfaces a Location whose only (FHIR) acupuncture availability comes via a PR-direct surface at that Location', async () => {
    const user = userEvent.setup();
    render(
      <Harness resourceTypes={['Location']} serviceCategoryCode="acupuncture" serviceCategoryFhirId="cat-acupuncture" />
    );

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // PR-Only Clinic's own Schedule is urgent-care (BOOKING_CONFIG) — not
    // acupuncture. No Group attached. The PR at the Location opts into
    // acupuncture via healthcareService[]. Strict FHIR rule admits the
    // Location via the PR-direct tier with the provider's name as the
    // sub-option suffix; one target at the winning tier ⇒ silent pick,
    // bare Location name.
    const hits = texts.filter((t) => t.includes('PR-Only Clinic'));
    expect(hits).toHaveLength(1);
    expect(hits[0]).not.toContain('(');
  });

  it('surfaces ambiguous Locations as sub-options when multiple Groups at the same Location support a FHIR category', async () => {
    const user = userEvent.setup();
    render(
      <Harness resourceTypes={['Location']} serviceCategoryCode="acupuncture" serviceCategoryFhirId="cat-acupuncture" />
    );

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const texts = await getOptionTexts();
    // Ambiguous Clinic has two Groups whose shared member PR opts into
    // acupuncture (via healthcareService back-ref). Location's own
    // Schedule covers urgent-care only — Tier 1 falls through. Both Groups
    // qualify at Tier 2 and surface as sub-options.
    const std = texts.find((t) => t.includes('Ambiguous Clinic') && t.includes('Acupuncture Standard'));
    const prem = texts.find((t) => t.includes('Ambiguous Clinic') && t.includes('Acupuncture Premium'));
    expect(std).toBeDefined();
    expect(prem).toBeDefined();
    const bare = texts.find((t) => /\bAmbiguous Clinic\b/.test(t) && !t.includes('('));
    expect(bare).toBeUndefined();
  });

  it('stamps atLocationSlug on Group sub-options so the slot loader can pass it to get-schedule (avoids "no slots" for multi-Location Groups)', async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    render(
      <Harness
        resourceTypes={['Location']}
        serviceCategoryCode="acupuncture"
        serviceCategoryFhirId="cat-acupuncture"
        onSelectedChange={onSelectedChange}
      />
    );

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    // Ambiguous Clinic has two acupuncture Groups; picking one exercises
    // the Group sub-option path. The selected BookableTarget must carry
    // atLocationSlug set to the origin Location's slug — that value gets
    // threaded into get-schedule (`atLocationSlug` param) so a Group whose
    // member Schedules span multiple Locations narrows to the picked
    // Location. Without atLocationSlug set, get-schedule returns
    // pickableLocations + empty slot list and the slot picker shows "no
    // slots" — the exact symptom this behavior exists to prevent.
    const option = await screen.findByText(/Ambiguous Clinic.*Acupuncture Standard/);
    await user.click(option);

    expect(onSelectedChange).toHaveBeenCalled();
    const selected = onSelectedChange.mock.calls.at(-1)?.[0] as BookableTarget | undefined;
    expect(selected?.resourceType).toBe('HealthcareService');
    expect(selected?.atLocationSlug).toBe('ambiguous-clinic');
  });

  it('does NOT stamp atLocationSlug on Location-tier picks (redundant with slug)', async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    // BOOKING_CONFIG category → resolver stays at Tier 1; picked target is
    // a Location. atLocationSlug is redundant with slug for
    // scheduleType=location and would just be noise — the picker leaves
    // it undefined so the slot loader's cache key stays stable.
    render(
      <Harness resourceTypes={['Location']} serviceCategoryCode="urgent-care" onSelectedChange={onSelectedChange} />
    );

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    const option = await screen.findByText(/NY Urgent Care/);
    await user.click(option);

    const selected = onSelectedChange.mock.calls.at(-1)?.[0] as BookableTarget | undefined;
    expect(selected?.resourceType).toBe('Location');
    expect(selected?.atLocationSlug).toBeUndefined();
  });

  it('FHIR category without fhirId: Location is dropped even when a PR at it would opt in via healthcareService — the resolver has no id to check', async () => {
    const user = userEvent.setup();
    // No serviceCategoryFhirId — the picker can't fall through to Group/PR
    // tiers for FHIR categories without the id. AddPatient is responsible
    // for threading it through; this test pins what happens when callers
    // forget (resolver returns nothing for those tiers, Location drops).
    // Tier 1 (Location-Schedule) still operates under strict FHIR rules,
    // so any Location whose own Schedule is untagged for acupuncture also
    // drops — and the dropdown can end up empty / with a "No options"
    // placeholder MUI renders instead of a listbox. Query options safely.
    render(<Harness resourceTypes={['Location']} serviceCategoryCode="acupuncture" />);

    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await openDropdown(user);

    // Whether MUI renders an empty listbox or a "No options" placeholder
    // varies by version — both states mean "no Location passes." Look for
    // PR-Only Clinic in the document body rather than insisting on a
    // listbox existing.
    await waitFor(() => {
      const matches = Array.from(document.querySelectorAll('li[role="option"]')).filter(
        (li) => li.textContent?.includes('PR-Only Clinic')
      );
      expect(matches).toHaveLength(0);
    });
  });

  it('clears a stale selection when serviceCategoryCode changes and the picked target no longer qualifies', async () => {
    const onSelectedChange = vi.fn();
    // Start with massage selected, no category filter — valid.
    const massageTarget: BookableTarget = {
      resourceType: 'Location',
      id: locInPersonMassage.id!,
      slug: 'massage-studio',
      name: 'Massage Studio',
    };

    const { rerender } = render(
      <Harness resourceTypes={['Location']} initialSelected={massageTarget} onSelectedChange={onSelectedChange} />
    );
    await waitFor(() => expect(mockSearch).toHaveBeenCalled());

    // Apply a category filter the selection doesn't satisfy.
    rerender(
      <Harness
        resourceTypes={['Location']}
        serviceCategoryCode="urgent-care"
        initialSelected={massageTarget}
        onSelectedChange={onSelectedChange}
      />
    );

    // Auto-clear is intentional: a stale selection would otherwise let the
    // form submit a Location that no longer offers the chosen service.
    await waitFor(() => {
      expect(onSelectedChange).toHaveBeenCalledWith(undefined);
    });
  });
});
