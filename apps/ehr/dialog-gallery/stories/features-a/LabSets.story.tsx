import { LabSets } from 'src/features/external-labs/components/LabSets';
import { LabSetDTO, LabSetStatus } from 'utils/lib/types/data/labs/lab-set.schema';
import { LabType } from 'utils/lib/types/data/labs/labs.types';
import { defineStory } from '../../harness/story';

const labSets: LabSetDTO[] = [
  {
    listId: 'set-1',
    listName: 'STI panel',
    listStatus: LabSetStatus.active,
    listType: LabType.external,
    labs: [
      { display: 'Chlamydia/Gonococcus, NAA', itemCode: '183194', labGuid: 'lab-1' },
      { display: 'HIV Ag/Ab with Reflex', itemCode: '083935', labGuid: 'lab-1' },
      { display: 'RPR with Reflex to Titer', itemCode: '012005', labGuid: 'lab-1' },
    ],
  },
  {
    listId: 'set-2',
    listName: 'Annual wellness',
    listStatus: LabSetStatus.active,
    listType: LabType.external,
    labs: [
      { display: 'CBC With Differential/Platelet', itemCode: '005009', labGuid: 'lab-1' },
      { display: 'Comp. Metabolic Panel (14)', itemCode: '322000', labGuid: 'lab-1' },
      { display: 'Lipid Panel', itemCode: '303756', labGuid: 'lab-1' },
    ],
  },
];

export default defineStory({
  title: 'Lab sets picker',
  source: 'apps/ehr/src/features/external-labs/components/LabSets.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'In-person visit → order external / in-house lab → "Lab Sets"',
  render: () => <LabSets labSets={labSets} setSelectedLabs={async () => undefined} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByText('Lab Sets'));
    await screen.findByRole('dialog');
  },
});
