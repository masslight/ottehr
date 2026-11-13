import { defineStory } from '../../harness/story';
import { ChatHost, chatMocks } from './_chat';

export default defineStory({
  title: 'Chat with patient (SMS)',
  source: 'apps/ehr/src/features/chat/ChatModal.tsx',
  base: 'MUI Dialog',
  kind: 'other',
  where: 'Tracking board → appointment row → chat icon; also Reports → Invoiceable patients',
  mocks: chatMocks,
  render: () => <ChatHost />,
  play: async ({ screen }) => {
    await screen.findByText(/I am parking now/, undefined, { timeout: 8000 });
  },
  notes: 'Conversation, quick texts and messaging config are mocked.',
});
