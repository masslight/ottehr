import ProfilePhotoImagePicker from 'src/features/visits/shared/components/ProfilePhotoImagePicker';
import { defineStory } from '../../harness/story';
import { patient, visitMocks, visitRoute } from './_fixtures';

// A generated placeholder picture stands in for the file the user would pick.
const makePhotoFile = async (): Promise<File> => {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cfd8dc';
  ctx.fillRect(0, 0, 900, 900);
  ctx.fillStyle = '#90a4ae';
  ctx.beginPath();
  ctx.arc(450, 340, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(450, 900, 290, 330, 0, Math.PI, 0);
  ctx.fill();
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  return new File([blob], 'photo.png', { type: 'image/png' });
};

export default defineStory({
  title: 'Patient profile photo — cropping a newly picked photo',
  source: 'apps/ehr/src/features/visits/shared/components/ProfilePhotoImagePicker.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit header → click the patient avatar → choose a photo file',
  ...visitRoute,
  mocks: visitMocks(),
  render: () => <ProfilePhotoImagePicker open setOpen={() => undefined} patient={patient} />,
  play: async ({ user, screen, waitFor }) => {
    const input = await waitFor(() => {
      const el = document.querySelector<HTMLInputElement>('.MuiDialog-root input[type="file"]');
      if (!el) throw new Error('file input not rendered yet');
      return el;
    });
    await user.upload(input, await makePhotoFile());
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    await waitFor(
      () => {
        if (!document.querySelector('.reactEasyCrop_CropArea')) throw new Error('cropper not ready');
      },
      { timeout: 10000 }
    );
  },
  notes: 'A canvas-generated placeholder image is uploaded through the real file input to reach the cropping step.',
});
