import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Extension, Location } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { LocationScheduleSummary } from 'utils/lib/types/api/locations';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationBookingLinks } from '../../src/features/locations/LocationBookingLinks';

// Booking links for a Location were lost when the Schedule General tab was replaced by this page —
// the links weren't carried over, and nothing failed, because nothing tested them. These pin what
// the widget emits so the next rewrite of this page has to notice.

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

const makeSchedule = (id: string, name?: string): LocationScheduleSummary => ({ id, name });

const ONE_SCHEDULE = [makeSchedule('sched-1')];

const renderWidget = (location: Location, schedules: LocationScheduleSummary[] = ONE_SCHEDULE): void => {
  render(
    <MemoryRouter>
      <LocationBookingLinks location={location} schedules={schedules} />
    </MemoryRouter>
  );
};

describe('LocationBookingLinks', () => {
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
    renderWidget(makeLocation({ slug: 'test-clinic' }), [
      makeSchedule('sched-1', 'Main desk'),
      makeSchedule('sched-2'),
    ]);

    expect(screen.getByText('Walk-in — Main desk')).toBeTruthy();
    // Second schedule carries no display-name extension, so it falls back to a positional label.
    expect(screen.getByText('Walk-in — Schedule 2')).toBeTruthy();
  });

  it('warns when the location owns no schedule', () => {
    // The prebook URL is still well-formed here — it resolves and then offers no times. Without the
    // warning the only symptom is a patient staring at an empty calendar.
    renderWidget(makeLocation({ slug: 'test-clinic' }), []);

    expect(screen.getByTestId('location-no-schedule-warning')).toBeTruthy();
    expect(screen.queryByText(/\/walkin\/schedule\//)).toBeNull();
  });

  it('sends the no-schedule warning to the create page with this location preselected', () => {
    // Without the id the admin lands on a picker and has to find the location they were just
    // looking at — and an inactive one isn't in that picker's list at all.
    renderWidget(makeLocation({ slug: 'test-clinic' }), []);

    expect(screen.getByTestId('location-create-schedule-link').getAttribute('href')).toBe(
      '/admin/schedule/add?location=loc-1'
    );
  });

  it('offers no links at all when the location has no slug', () => {
    renderWidget(makeLocation({}));

    expect(screen.queryByText(/\/prebook\//)).toBeNull();
    expect(screen.getByText(/no slug/)).toBeTruthy();
  });

  it('links through to each schedule it was given', () => {
    renderWidget(makeLocation({ slug: 'test-clinic' }), [
      makeSchedule('sched-1', 'Main desk'),
      makeSchedule('sched-2'),
    ]);

    expect(screen.getByTestId('location-schedule-link-sched-1').getAttribute('href')).toBe(
      '/admin/schedule/id/sched-1'
    );
    expect(screen.getByTestId('location-schedule-link-sched-2').getAttribute('href')).toBe(
      '/admin/schedule/id/sched-2'
    );
  });

  describe('copy button', () => {
    afterEach(() => {
      // jsdom has no clipboard; each test installs the shape it needs and clears up after itself.
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    });

    const clickFirstCopyButton = async (): Promise<void> => {
      await userEvent.click(screen.getAllByRole('button', { name: /^Copy .* link$/ })[0]);
    };

    it('labels each copy button with the link it copies', () => {
      renderWidget(makeLocation({ slug: 'test-clinic', modes: ['vi', 'in-person'] }));

      // Icon-only buttons have no accessible name from their content, so the label is the only thing
      // a screen reader can announce — and three identical "Copy" buttons would be useless anyway.
      expect(screen.getByRole('button', { name: 'Copy Prebook (In person) link' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Copy Prebook (Virtual) link' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Copy Walk-in link' })).toBeTruthy();
    });

    it('writes the link to the clipboard and confirms', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      renderWidget(makeLocation({ slug: 'test-clinic' }));

      await clickFirstCopyButton();

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/prebook/in-person?bookingOn=test-clinic'));
      await waitFor(() => expect(screen.getByText('Link copied!')).toBeTruthy());
    });

    it('says so instead of throwing when the clipboard API is missing', async () => {
      // No secure context (plain http on anything but localhost) means no navigator.clipboard at
      // all, so the unguarded call threw a TypeError out of the click handler.
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      renderWidget(makeLocation({ slug: 'test-clinic' }));

      await clickFirstCopyButton();

      await waitFor(() => expect(screen.getByText(/Couldn’t copy/)).toBeTruthy());
    });

    it('says so instead of claiming success when the write is rejected', async () => {
      // Permission can be refused even where the API exists; the old code reported "Link copied!"
      // either way and sent people off to paste something they didn't have.
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      renderWidget(makeLocation({ slug: 'test-clinic' }));

      await clickFirstCopyButton();

      await waitFor(() => expect(screen.getByText(/Couldn’t copy/)).toBeTruthy());
    });
  });
});
