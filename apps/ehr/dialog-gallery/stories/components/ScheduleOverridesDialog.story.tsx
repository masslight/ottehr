import ScheduleOverridesDialog from 'src/components/schedule/ScheduleOverridesDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Schedule change may affect visits',
  source: 'apps/ehr/src/components/schedule/ScheduleOverridesDialog.tsx',
  base: 'AppDialog',
  kind: 'confirm',
  where: 'Admin → Schedule → Schedule overrides → Save',
  render: () => (
    <ScheduleOverridesDialog open loading={false} handleClose={() => undefined} handleConfirm={() => undefined} />
  ),
});
