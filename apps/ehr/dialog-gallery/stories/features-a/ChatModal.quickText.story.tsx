import { defineStory } from '../../harness/story';
import { ChatHost, chatMocks } from './_chat';

export default defineStory({
  title: 'Quick text picker (patient chat)',
  source: 'apps/ehr/src/features/chat/ChatModal.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Patient chat modal → "Quick text"',
  mocks: chatMocks,
  render: () => <ChatHost />,
  play: async ({ user, screen }) => {
    await screen.findByText(/I am parking now/, undefined, { timeout: 8000 });
    await user.click(screen.getByRole('button', { name: 'Quick text' }));
    await screen.findByText('Room ready');
  },
  notes: 'Opens stacked on top of the chat modal, as in the product. Quick texts are mocked.',
});
