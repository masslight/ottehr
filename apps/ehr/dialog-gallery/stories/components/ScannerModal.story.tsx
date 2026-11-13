import { ScannerModal } from 'src/components/ScannerModal';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Scan document',
  source: 'apps/ehr/src/components/ScannerModal.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Patient documents / visit cards → Scan',
  notes:
    'No Dynamsoft TWAIN service or physical scanner exists in the capture sandbox, so the scanner list is empty and the viewer pane is blank.',
  render: () => <ScannerModal open onClose={() => undefined} />,
});
