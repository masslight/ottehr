import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LOCATION_REVIEW_LINK_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { GetProviderJournalResponse, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { QuickTextQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildQuickTextVariables, resolveQuickText } from '../../src/features/chat/chat.queries';
import { JournalPage } from '../../src/features/journal/pages/JournalPage';

const ME = '11111111-1111-4111-8111-111111111111';
const { chatProps } = vi.hoisted(() => ({ chatProps: [] as any[] }));

// The seeded quick texts (quick-texts-seed.json).
const TRYING_TO_REACH_YOU: QuickTextQuickPickData = {
  name: 'Trying to reach you',
  english:
    '{{practice-name}} is trying to get a hold of you. Please call us at {{office-phone}} or respond to this text message.',
} as QuickTextQuickPickData;
const COMPLETE_PAPERWORK: QuickTextQuickPickData = {
  name: 'Complete Paperwork',
  english:
    'Please complete the paperwork and sign consent forms to avoid a delay in check-in. For {{patient-first-name}}, click here: {{paperwork-url}}',
} as QuickTextQuickPickData;

const visit: JournalVisit = {
  appointmentId: 'appt-1',
  encounterId: 'enc-1',
  start: '2026-11-17T14:00:00Z',
  isTelemed: false,
  isFollowUp: false,
  status: 'completed',
  hasProgressNote: true,
  location: {
    resourceType: 'Location',
    id: 'loc-ny',
    name: 'New York',
    telecom: [{ system: 'phone', value: '+19195550100' }],
    extension: [{ url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://review.example/ny' }],
  },
};

const phone = { number: '+19195550123', recipientResourceUri: 'RelatedPerson/rp-1' };
const journal: GetProviderJournalResponse = {
  kind: 'provider',
  comingUp: [],
  today: [],
  todayDone: [],
  seenTodayCount: 0,
  past: [],
  recent: [
    {
      patient: { patientId: 'pat-ava', name: 'Ava Lin', firstName: 'Ava', lastName: 'Lin', phones: [phone] },
      visits: [visit],
      lastSeen: visit.start,
      items: [
        {
          id: 't1',
          taskId: 't1',
          kind: 'text-message',
          label: 'Reply to Ava',
          when: 'received',
          since: '2026-11-19T15:00:00Z',
          patientId: 'pat-ava',
          appointmentId: 'appt-1',
          encounterId: 'enc-1',
        },
      ],
    },
  ],
  notTied: [
    {
      patient: { patientId: 'pat-jay', name: 'Jay Text', firstName: 'Jay', lastName: 'Text', phones: [phone] },
      visits: [],
      items: [
        {
          id: 't2',
          taskId: 't2',
          kind: 'text-message',
          label: 'Reply to Jay',
          when: 'received',
          since: '2026-11-19T15:00:00Z',
          patientId: 'pat-jay',
        },
      ],
    },
  ],
};

vi.mock('../../src/features/journal/hooks/useProviderJournal', () => ({
  useProviderJournal: () => ({ data: journal, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('../../src/features/journal/hooks/useJournalOwners', () => ({
  useJournalOwners: () => ({
    owners: [{ practitionerId: ME, name: 'Ana Rivera' }],
    myPractitionerId: ME,
    isLoading: false,
  }),
}));
vi.mock('../../src/hooks/useLocationSupportPhones', () => ({
  useSupportPhonesMap: () => ({ phonesByLocationName: { 'New York': '(800) 555-0199' } }),
}));
vi.mock('src/api/api', () => ({}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }) }));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/features/chat/ChatModal', () => ({
  default: (props: any) => {
    chatProps.push(props);
    return <div>chat open</div>;
  },
}));

const openChat = async (label: string): Promise<Record<string, string>> => {
  render(
    <MemoryRouter>
      <JournalPage />
    </MemoryRouter>
  );
  await userEvent.click(screen.getByText(label));
  return buildQuickTextVariables(chatProps.at(-1).quickTextsContext);
};

describe('JournalPage chat quick texts', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_PATIENT_APP_URL', 'https://portal.example');
    // The tracking board's last-selected location: the journal must not fall back to it.
    localStorage.setItem(
      'selectedLocation',
      JSON.stringify({
        resourceType: 'Location',
        name: 'Elsewhere',
        telecom: [{ system: 'phone', value: '+12125550000' }],
      })
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('fills the tracking board’s values from the chat visit’s own Location', async () => {
    const vars = await openChat('Reply to Ava');
    expect(resolveQuickText(TRYING_TO_REACH_YOU, vars).english).toMatch(
      /Please call us at \(919\) 555-0100 or respond/
    );
    expect(resolveQuickText(COMPLETE_PAPERWORK, vars).english).toBe(
      'Please complete the paperwork and sign consent forms to avoid a delay in check-in. For Ava, click here: https://portal.example/visit/appt-1'
    );
    expect(vars['location-name']).toBe('New York');
    expect(vars['location-review-link']).toBe('https://review.example/ny');
    expect(vars['support-phone']).toBe('(800) 555-0199');
    expect(vars['booking-time']).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
  });

  it('passes no visit id or location for a row with no visit (no last-selected-location fallback)', async () => {
    const vars = await openChat('Reply to Jay');
    const context = chatProps.at(-1).quickTextsContext;
    expect(context.visitId).toBeUndefined();
    expect(vars['paperwork-url']).toBe('');
    expect(vars['location-name']).toBe('');
    expect(resolveQuickText(TRYING_TO_REACH_YOU, vars).english).not.toContain('212');
  });
});
