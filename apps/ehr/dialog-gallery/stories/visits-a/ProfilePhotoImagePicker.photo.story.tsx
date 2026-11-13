import ProfilePhotoImagePicker from 'src/features/visits/shared/components/ProfilePhotoImagePicker';
import { defineStory } from '../../harness/story';
import { patient, visitMocks, visitRoute } from './_fixtures';

// Stand-in for the presigned photo URL (the capture sandbox blocks external image hosts).
const placeholderPhoto =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#cfd8dc"/><circle cx="300" cy="300" r="130" fill="#90a4ae"/><path d="M60 800c0-170 110-270 240-270s240 100 240 270z" fill="#90a4ae"/></svg>'
  );

const patientWithPhoto = {
  ...patient,
  photo: [
    { contentType: 'image/jpeg', creation: '2026-10-02T14:30:00.000Z', url: 'https://mock.invalid/z3/photo.jpg' },
  ],
};

export default defineStory({
  title: 'Patient profile photo — existing photo (update / remove)',
  source: 'apps/ehr/src/features/visits/shared/components/ProfilePhotoImagePicker.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Visit header → click the patient avatar',
  ...visitRoute,
  mocks: [
    ...visitMocks(['Provider'], patientWithPhoto),
    { url: 'patient-profile-photo', response: { status: 200, output: { presignedImageUrl: placeholderPhoto } } },
  ],
  render: () => <ProfilePhotoImagePicker open setOpen={() => undefined} patient={patientWithPhoto} />,
  play: async ({ screen, waitFor }) => {
    await waitFor(() => screen.getByRole('button', { name: 'Remove photo' }), { timeout: 10000 });
  },
  notes: 'The photo itself is a grey placeholder silhouette (data: URI) returned as the mocked presigned URL.',
});
