import { render, screen } from '@testing-library/react';
import { Extension, Location, Schedule } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { SCHEDULE_DISPLAY_NAME_EXTENSION_URL, SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Booking links for a Location were lost when the Schedule General tab was replaced by this page —
// the links weren't carried over, and nothing failed, because nothing tested them. These pin what
// the widget emits so the next rewrite of this page has to notice.

const mockSchedulesQuery = vi.fn<() => { data: Schedule[] | undefined; isLoading: boolean }>();
vi.mock('src/features/locations/location.queries', async (importOriginal) => ({
  ...((await importOriginal()) as any),
  useLocationSchedulesQuery: () => mockSchedulesQuery(),
}));

import { LocationBookingLinks } from '../../src/features/locations/LocationBookingLinks';

// A Location declares its service modes as codings on the location-form extension. Both may be
// present at once — that's the dual-mode case the prebook links have to split apart. In-person is
// also the implicit default when no coding says otherwise (back-compat for pre-flag Locations).
const modeExtension = (code: 'vi' | 'in-person'): Extension => ({
  url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
  valueCoding: { system: 'http://terminology.hl7.org/CodeSystem/location-form', code },
});

const makeLocation = (opts: { slug?: string; modes?: Array<'vi' | 'in-person'> } = {}): Location => ({
  resourceType: 'Location',
  id: 'loc-1',
  name: 'Test Clinic',
  status: 'active',
  ...(opts.slug === undefined ? {} : { identifier: [{ system: SLUG_SYSTEM, value: opts.slug }] }),
  ...(opts.modes ? { extension: opts.modes.map(modeExtension) } : {}),
});

const makeSchedule = (id: string, displayName?: string): Schedule => ({
  resourceType: 'Schedule',
  id,
  actor: [{ reference: 'Location/loc-1' }],
  ...(displayName ? { extension: [{ url: SCHEDULE_DISPLAY_NAME_EXTENSION_URL, valueString: displayName }] } : {}),
});

const renderWidget = (location: Location): void => {
  render(
    <MemoryRouter>
      <LocationBookingLinks location={location} />
    </MemoryRouter>
  );
};

describe('LocationBookingLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchedulesQuery.mockReturnValue({ data: [makeSchedule('sched-1')], isLoading: false });
  });

  it('emits one prebook link per enabled service mode', () => {
    // A Location may be both virtual and in-person; a single "Prebook" link would silently pick one.
    const location = makeLocation({ slug: 'test-clinic', modes: ['vi', 'in-person'] });
    renderWidget(location);

    expect(screen.getByText(/\/prebook\/in-person\?bookingOn=test-clinic/)).toBeTruthy();
    expect(screen.getByText(/\/prebook\/virtual\?bookingOn=test-clinic/)).toBeTruthy();
  });

  it('keys the walk-in link to the schedule id, not the location name', () => {
    // `/walkin/location/:name` also exists but resolves by name, so renaming the location breaks
    // every link already shared. The schedule-keyed form survives a rename.
    renderWidget(makeLocation({ slug: 'test-clinic' }));

    expect(screen.getByText(/\/walkin\/schedule\/sched-1$/)).toBeTruthy();
  });

  it('names each walk-in link when the location owns more than one schedule', () => {
    mockSchedulesQuery.mockReturnValue({
      data: [makeSchedule('sched-1', 'Main desk'), makeSchedule('sched-2')],
      isLoading: false,
    });
    renderWidget(makeLocation({ slug: 'test-clinic' }));

    expect(screen.getByText('Walk-in — Main desk')).toBeTruthy();
    // Second schedule carries no display-name extension, so it falls back to a positional label.
    expect(screen.getByText('Walk-in — Schedule 2')).toBeTruthy();
  });

  it('warns when the location owns no schedule', () => {
    // The prebook URL is still well-formed here — it resolves and then offers no times. Without the
    // warning the only symptom is a patient staring at an empty calendar.
    mockSchedulesQuery.mockReturnValue({ data: [], isLoading: false });
    renderWidget(makeLocation({ slug: 'test-clinic' }));

    expect(screen.getByTestId('location-no-schedule-warning')).toBeTruthy();
    expect(screen.queryByText(/\/walkin\/schedule\//)).toBeNull();
  });

  it('offers no links at all when the location has no slug', () => {
    renderWidget(makeLocation({}));

    expect(screen.queryByText(/\/prebook\//)).toBeNull();
    expect(screen.getByText(/no slug/)).toBeTruthy();
  });

  it('links through to each schedule it found', () => {
    mockSchedulesQuery.mockReturnValue({
      data: [makeSchedule('sched-1', 'Main desk'), makeSchedule('sched-2')],
      isLoading: false,
    });
    renderWidget(makeLocation({ slug: 'test-clinic' }));

    expect(screen.getByTestId('location-schedule-link-sched-1').getAttribute('href')).toBe(
      '/admin/schedule/id/sched-1'
    );
    expect(screen.getByTestId('location-schedule-link-sched-2').getAttribute('href')).toBe(
      '/admin/schedule/id/sched-2'
    );
  });
});
