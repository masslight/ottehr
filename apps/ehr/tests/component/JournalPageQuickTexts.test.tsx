import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LOCATION_REVIEW_LINK_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { GetProviderJournalResponse, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { QuickTextQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildQuickTextVariables, offeredQuickTexts, resolveQuickText } from '../../src/features/chat/chat.queries';
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
const COMPLETE_AI_INTAKE: QuickTextQuickPickData = {
  name: 'Complete AI HPI Intake',
  english:
    'Please complete a brief AI chat session for {{patient-first-name}} to help your provider prepare for your visit: {{ai-interview-url}}',
} as QuickTextQuickPickData;
const QUICK_TEXTS = [COMPLETE_AI_INTAKE, COMPLETE_PAPERWORK, TRYING_TO_REACH_YOU];

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
      // The newest to-do's own Location, from the server.
      location: {
        resourceType: 'Location',
        id: 'loc-main',
        name: 'Main St',
        telecom: [{ system: 'phone', value: '+19195550177' }],
      },
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
    expect(vars['location-name']).toBe('New York');
    expect(vars['location-review-link']).toBe('https://review.example/ny');
    expect(vars['support-phone']).toBe('(800) 555-0199');
    expect(vars['booking-time']).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
  });

  it('fills a row with no visit from its newest to-do’s Location and offers no visit-link quick texts', async () => {
    const vars = await openChat('Reply to Jay');
    const context = chatProps.at(-1).quickTextsContext;
    expect(context.visitId).toBeUndefined();
    expect(vars['location-name']).toBe('Main St');
    expect(resolveQuickText(TRYING_TO_REACH_YOU, vars).english).toBe(
      `${vars['practice-name']} is trying to get a hold of you. Please call us at (919) 555-0177 or respond to this text message.`
    );
    expect(offeredQuickTexts(QUICK_TEXTS, context).map((q) => q.name)).toEqual(['Trying to reach you']);
  });

  it('doesn’t offer the paperwork or AI interview link on a Recent row whose visits are over', async () => {
    await openChat('Reply to Ava');
    const context = chatProps.at(-1).quickTextsContext;
    expect(context.visitId).toBeUndefined();
    expect(offeredQuickTexts(QUICK_TEXTS, context).map((q) => q.name)).toEqual(['Trying to reach you']);
  });

  it('links paperwork to today’s visit on a Today row and offers every quick text', async () => {
    const today: JournalVisit = {
      ...visit,
      appointmentId: 'appt-today',
      encounterId: 'enc-today',
      start: DateTime.now().startOf('hour').toISO()!,
      status: 'provider',
    };
    journal.today = [
      {
        ...journal.recent[0],
        visit: today,
        visits: [today, visit],
        items: [
          { ...journal.recent[0].items[0], label: 'Reply today', appointmentId: undefined, encounterId: undefined },
        ],
      },
    ];
    try {
      const vars = await openChat('Reply today');
      expect(vars['paperwork-url']).toBe('https://portal.example/visit/appt-today');
      expect(offeredQuickTexts(QUICK_TEXTS, chatProps.at(-1).quickTextsContext)).toEqual(QUICK_TEXTS);
    } finally {
      journal.today = [];
    }
  });

  it('links paperwork to the upcoming booking, while Progress Note and the office values stay on the started visit', async () => {
    const booking: JournalVisit = {
      ...visit,
      appointmentId: 'appt-booked',
      encounterId: 'enc-booked',
      start: DateTime.now().plus({ days: 7 }).toISO()!,
      status: 'pending',
      hasProgressNote: false,
      location: { resourceType: 'Location', id: 'loc-booked', name: 'Booked Location' },
    };
    const row = journal.recent[0];
    const saved = { visits: row.visits, items: row.items };
    row.visits = [booking, visit];
    row.items = [{ ...row.items[0], appointmentId: 'appt-booked', encounterId: 'enc-booked' }];
    try {
      const vars = await openChat('Reply to Ava');
      expect(vars['paperwork-url']).toBe('https://portal.example/visit/appt-booked');
      expect(vars['ai-interview-url']).toBe('https://portal.example/visit/appt-booked/ai-interview-start');
      expect(vars['location-name']).toBe('New York');
      expect(vars['booking-time']).toBe(DateTime.fromISO(visit.start).toFormat('h:mm a'));
      expect(offeredQuickTexts(QUICK_TEXTS, chatProps.at(-1).quickTextsContext)).toEqual(QUICK_TEXTS);
      expect(screen.getByRole('link', { name: 'Progress Note' }).getAttribute('href')).toContain('/in-person/appt-1/');
    } finally {
      Object.assign(row, saved);
    }
  });
});
