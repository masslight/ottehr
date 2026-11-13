import { useEmployeeChatStore } from 'src/features/employee-chat/employee-chat.store';
import { EmployeeChatDrawer } from 'src/features/employee-chat/EmployeeChatDrawer';
import { defineStory } from '../../harness/story';
import { conversationState, employeeChatMocks } from './_employeeChat';

export default defineStory({
  title: 'Employee chat drawer (conversation)',
  source: 'apps/ehr/src/features/employee-chat/EmployeeChatDrawer.tsx',
  base: 'MUI Drawer',
  kind: 'other',
  where: 'Navbar → chat icon → select a chat',
  mocks: employeeChatMocks,
  setup: () => useEmployeeChatStore.setState(conversationState),
  render: () => <EmployeeChatDrawer />,
  notes:
    'Temporary right-anchored drawer. The Twilio Conversations connection is not started; the zustand store is seeded as "connected" with mock chats/messages.',
});
