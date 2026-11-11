import { DateTime } from 'luxon';
import {
  IsoWeekday,
  ProviderScheduleConfig,
  ScheduleLocation,
  ScheduleProvider,
  ScheduleVisitType,
  TemplateBlock,
} from 'utils/lib/provider-schedule/types';

/** Demo data for the mock API. Dates are relative to "today" so the calendar always has content. */

export const MOCK_LOCATIONS: ScheduleLocation[] = [
  { id: 'loc-main', name: 'Main Street Primary Care', timezone: 'America/New_York' },
];

export const MOCK_PROVIDERS: ScheduleProvider[] = [
  { id: 'prov-patel', name: 'Maya Patel', credentials: 'MD', locationIds: ['loc-main'] },
  { id: 'prov-okafor', name: 'James Okafor', credentials: 'DO', locationIds: ['loc-main'] },
  { id: 'prov-ruiz', name: 'Lena Ruiz', credentials: 'NP', locationIds: ['loc-main'] },
];

export const MOCK_VISIT_TYPES: ScheduleVisitType[] = [
  {
    id: 'vt-annual',
    name: 'Annual physical',
    serviceCategoryCode: 'annual-physical',
    defaultDurationMinutes: 40,
    color: '#2a6fdb',
  },
  {
    id: 'vt-new',
    name: 'New patient',
    serviceCategoryCode: 'new-patient',
    defaultDurationMinutes: 40,
    color: '#7b4fd6',
  },
  {
    id: 'vt-awv',
    name: 'Medicare wellness',
    serviceCategoryCode: 'medicare-awv',
    defaultDurationMinutes: 40,
    color: '#0f8b8d',
  },
  {
    id: 'vt-followup',
    name: 'Follow-up',
    serviceCategoryCode: 'follow-up',
    defaultDurationMinutes: 20,
    color: '#2e8540',
  },
  {
    id: 'vt-tele',
    name: 'Telehealth follow-up',
    serviceCategoryCode: 'telehealth-follow-up',
    defaultDurationMinutes: 20,
    color: '#c26a00',
  },
  {
    id: 'vt-sick',
    name: 'Same-day sick',
    serviceCategoryCode: 'same-day-sick',
    defaultDurationMinutes: 15,
    color: '#c73a3a',
  },
  {
    id: 'vt-procedure',
    name: 'Procedure',
    serviceCategoryCode: 'procedure',
    defaultDurationMinutes: 30,
    color: '#8a5a2b',
  },
];

let blockSeq = 0;
const blocksForDays = (
  weekdays: IsoWeekday[],
  spec: Omit<TemplateBlock, 'id' | 'weekday' | 'cycleWeek'>,
  cycleWeek = 1
): TemplateBlock[] => weekdays.map((weekday) => ({ ...spec, id: `seed-${++blockSeq}`, weekday, cycleWeek }));

const MON_FRI: IsoWeekday[] = [1, 2, 3, 4, 5];

const huddle = (days: IsoWeekday[], week = 1): TemplateBlock[] =>
  blocksForDays(
    days,
    { startTime: '08:00', endTime: '08:15', kind: 'unavailable', label: 'Huddle', reason: 'huddle', visitTypeIds: [] },
    week
  );
const lunch = (days: IsoWeekday[], week = 1): TemplateBlock[] =>
  blocksForDays(
    days,
    { startTime: '12:00', endTime: '13:00', kind: 'unavailable', label: 'Lunch', reason: 'lunch', visitTypeIds: [] },
    week
  );

const startOfThisYear = DateTime.now().startOf('year').toISODate()!;

export const buildMockConfigs = (): Record<string, ProviderScheduleConfig> => {
  const today = DateTime.now().setZone(MOCK_LOCATIONS[0].timezone).startOf('day');
  const nextFriday = today.plus({ weeks: 1 }).set({ weekday: 5 }).toISODate()!;
  const thisThursday = (
    today.weekday <= 4 ? today.set({ weekday: 4 }) : today.plus({ weeks: 1 }).set({ weekday: 4 })
  ).toISODate()!;
  const nextSaturday = today.plus({ weeks: 1 }).set({ weekday: 6 }).toISODate()!;

  return {
    'prov-patel': {
      providerId: 'prov-patel',
      timezone: MOCK_LOCATIONS[0].timezone,
      visitTypeSettings: [
        { visitTypeId: 'vt-new', enabled: true, durationMinutes: 60 },
        { visitTypeId: 'vt-awv', enabled: true, maxPerDay: 2 },
      ],
      templates: [
        {
          id: 'tmpl-patel-std',
          name: 'Standard week',
          locationId: 'loc-main',
          effectiveFrom: startOfThisYear,
          cycleWeeks: 1,
          blocks: [
            ...huddle(MON_FRI),
            ...blocksForDays(MON_FRI, {
              startTime: '08:15',
              endTime: '10:15',
              kind: 'bookable',
              label: 'Physicals & new patients',
              visitTypeIds: ['vt-annual', 'vt-new', 'vt-awv'],
            }),
            ...blocksForDays(MON_FRI, {
              startTime: '10:15',
              endTime: '12:00',
              kind: 'bookable',
              label: 'Follow-ups',
              visitTypeIds: ['vt-followup', 'vt-tele'],
            }),
            ...lunch(MON_FRI),
            ...blocksForDays([1, 2, 4, 5], {
              startTime: '13:00',
              endTime: '15:00',
              kind: 'bookable',
              label: 'Follow-ups & procedures',
              visitTypeIds: ['vt-followup', 'vt-procedure'],
            }),
            ...blocksForDays([1, 2, 4, 5], {
              startTime: '15:00',
              endTime: '16:30',
              kind: 'bookable',
              label: 'Same-day sick',
              visitTypeIds: ['vt-sick'],
            }),
            ...blocksForDays([3], {
              startTime: '13:00',
              endTime: '17:00',
              kind: 'unavailable',
              label: 'Admin time',
              reason: 'admin',
              visitTypeIds: [],
            }),
          ],
        },
      ],
      exceptions: [
        { id: 'exc-patel-pto', date: nextFriday, kind: 'unavailable', label: 'PTO', reason: 'other', visitTypeIds: [] },
        {
          id: 'exc-patel-mtg',
          date: thisThursday,
          kind: 'unavailable',
          label: 'Quality committee',
          reason: 'meeting',
          startTime: '13:00',
          endTime: '14:00',
          visitTypeIds: [],
        },
      ],
    },
    'prov-okafor': {
      providerId: 'prov-okafor',
      timezone: MOCK_LOCATIONS[0].timezone,
      visitTypeSettings: [{ visitTypeId: 'vt-procedure', enabled: false }],
      templates: [
        {
          id: 'tmpl-okafor-alt',
          name: 'Alternating Fridays',
          locationId: 'loc-main',
          effectiveFrom: startOfThisYear,
          cycleWeeks: 2,
          blocks: [1, 2].flatMap((week) => [
            ...huddle(week === 1 ? MON_FRI : [1, 2, 3, 4], week),
            ...blocksForDays(
              week === 1 ? MON_FRI : [1, 2, 3, 4],
              { startTime: '08:15', endTime: '12:00', kind: 'bookable', label: 'Clinic', visitTypeIds: [] },
              week
            ),
            ...lunch(week === 1 ? MON_FRI : [1, 2, 3, 4], week),
            ...blocksForDays(
              week === 1 ? MON_FRI : [1, 2, 3, 4],
              { startTime: '13:00', endTime: '17:00', kind: 'bookable', label: 'Clinic', visitTypeIds: [] },
              week
            ),
          ]),
        },
      ],
      exceptions: [],
    },
    'prov-ruiz': {
      providerId: 'prov-ruiz',
      timezone: MOCK_LOCATIONS[0].timezone,
      visitTypeSettings: [
        { visitTypeId: 'vt-new', enabled: false },
        { visitTypeId: 'vt-awv', enabled: false },
        { visitTypeId: 'vt-sick', enabled: true, durationMinutes: 20 },
      ],
      templates: [
        {
          id: 'tmpl-ruiz-std',
          name: 'Acute care focus',
          locationId: 'loc-main',
          effectiveFrom: startOfThisYear,
          cycleWeeks: 1,
          blocks: [
            ...blocksForDays([2, 3, 4, 5, 6], {
              startTime: '09:00',
              endTime: '12:30',
              kind: 'bookable',
              label: 'Same-day sick',
              visitTypeIds: ['vt-sick'],
            }),
            ...blocksForDays([2, 3, 4, 5], {
              startTime: '12:30',
              endTime: '13:30',
              kind: 'unavailable',
              label: 'Lunch',
              reason: 'lunch',
              visitTypeIds: [],
            }),
            ...blocksForDays([2, 3, 4, 5], {
              startTime: '13:30',
              endTime: '18:00',
              kind: 'bookable',
              label: 'Follow-ups & sick',
              visitTypeIds: ['vt-followup', 'vt-tele', 'vt-sick'],
            }),
          ],
        },
      ],
      exceptions: [
        {
          id: 'exc-ruiz-flu',
          date: nextSaturday,
          kind: 'bookable',
          label: 'Flu shot clinic',
          startTime: '13:00',
          endTime: '15:00',
          visitTypeIds: ['vt-procedure'],
        },
      ],
    },
  };
};

export const MOCK_PATIENT_NAMES = [
  'Avery Brooks',
  'Jordan Lee',
  'Sam Rivera',
  'Taylor Kim',
  'Morgan Chen',
  'Casey Nguyen',
  'Riley Adams',
  'Quinn Patel',
  'Jamie Ortiz',
  'Drew Walker',
  'Reese Moore',
  'Skyler Hayes',
  'Parker Diaz',
  'Rowan Scott',
  'Emerson Ward',
  'Hayden Price',
];
