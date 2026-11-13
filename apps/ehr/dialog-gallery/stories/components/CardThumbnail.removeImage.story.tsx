import CardThumbnail from 'src/components/CardThumbnail';
import { defineStory } from '../../harness/story';
import { placeholderImage } from './_shared';

const doc = (url: string, type: string): any => ({ z3Url: `z3://mock/${type}.png`, presignedUrl: url, type });

export default defineStory({
  title: 'Remove card image',
  source: 'apps/ehr/src/components/CardThumbnail.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'Visit details → insurance / ID card thumbnail → enlarge → delete icon in the floating preview',
  notes:
    'Card images are inline SVG placeholders. The non-modal FloatingCardPreview the dialog is opened from stays visible behind it, as in the app.',
  render: () => (
    <CardThumbnail
      item={{
        front: doc(placeholderImage.front, 'photo-id-front'),
        frontId: 'docref-front',
        back: doc(placeholderImage.back, 'photo-id-back'),
        backId: 'docref-back',
      }}
      title="ID Card"
      appointmentID="appt-1"
      filesMutator={{ mutateAsync: async () => undefined, isPending: false } as any}
      uploadingFileType={null}
      handleOpenScanner={() => undefined}
      frontFileType="photo-id-front"
      backFileType="photo-id-back"
      handleDeleteClick={async () => undefined}
      deletingFileId={null}
    />
  ),
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'Enlarge ID Card' }));
    await user.click(await screen.findByRole('button', { name: 'Remove ID Card front' }));
  },
});
