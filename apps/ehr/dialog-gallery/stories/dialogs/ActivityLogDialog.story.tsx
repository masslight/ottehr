import ActivityLogDialog from 'src/components/dialogs/ActivityLogDialog';
import { ActivityLogData, ActivityName } from 'src/helpers/activityLogsUtils';
import { defineStory } from '../../harness/story';

const logs: ActivityLogData[] = [
  {
    activityDateTimeISO: '2026-11-13T15:42:00.000Z',
    activityDateTime: '11/13/2026 10:42 AM',
    activityName: ActivityName.statusChange,
    activityNameSupplement: 'intake',
    activityBy: 'Dana Whitfield, RN',
  },
  {
    activityDateTimeISO: '2026-11-13T15:31:00.000Z',
    activityDateTime: '11/13/2026 10:31 AM',
    activityName: ActivityName.nameChange,
    activityBy: 'Marcus Chen',
    moreDetails: { valueBefore: 'Jordan Rivera', valueAfter: 'Jordan Lee Rivera' },
  },
  {
    activityDateTimeISO: '2026-11-13T15:20:00.000Z',
    activityDateTime: '11/13/2026 10:20 AM',
    activityName: ActivityName.paperworkStarted,
    activityBy: 'Patient',
  },
  {
    activityDateTimeISO: '2026-11-13T15:05:00.000Z',
    activityDateTime: '11/13/2026 10:05 AM',
    activityName: ActivityName.apptCreation,
    activityBy: 'Staff Marcus Chen',
  },
];

export default defineStory({
  title: 'Visit activity log',
  source: 'apps/ehr/src/components/dialogs/ActivityLogDialog.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Visit details page → "Activity logs" link',
  notes: 'Log rows are mock data; "See Details" rows left collapsed (default).',
  render: () => <ActivityLogDialog open handleClose={() => undefined} logs={logs} />,
});
