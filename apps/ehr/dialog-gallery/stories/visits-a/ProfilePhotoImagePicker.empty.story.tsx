import ProfilePhotoImagePicker from 'src/features/visits/shared/components/ProfilePhotoImagePicker';
import { defineStory } from '../../harness/story';
import { patient, visitMocks, visitRoute } from './_fixtures';

export default defineStory({
  title: 'Patient profile photo — no photo yet (upload prompt)',
  source: 'apps/ehr/src/features/visits/shared/components/ProfilePhotoImagePicker.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Visit header → click the patient avatar',
  ...visitRoute,
  mocks: visitMocks(),
  render: () => <ProfilePhotoImagePicker open setOpen={() => undefined} patient={patient} />,
});
