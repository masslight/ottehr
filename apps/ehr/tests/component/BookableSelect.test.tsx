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
    ];
  } else if (params.resourceType === 'HealthcareService') {
    resources = [group];
  } else if (params.resourceType === 'PractitionerRole') {
    resources = [role, practitioner];
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
