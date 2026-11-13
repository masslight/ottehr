import { EmployeeChatState } from 'src/features/employee-chat/employee-chat.store';
import { FetchMock } from '../../harness/story';

const jane = { profile: 'Practitioner/practitioner-2', firstName: 'Jane', lastName: 'Smith', name: 'Jane Smith' };
const omar = { profile: 'Practitioner/practitioner-3', firstName: 'Omar', lastName: 'Haddad', name: 'Omar Haddad' };
const today = new Date();
const at = (hours: number, minutes: number): string =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes).toISOString();

export const listState: Partial<EmployeeChatState> = {
  status: 'connected',
  myProfile: 'Practitioner/practitioner-1',
  drawerOpen: true,
  view: 'list',
  chats: {
    CH1: {
      sid: 'CH1',
      otherEmployee: jane,
      lastMessageIndex: 3,
      lastMessageAt: at(9, 41),
      lastReadIndex: 2,
      preview: { body: 'Room 3 is ready for your next patient.', mine: false },
    },
    CH2: {
      sid: 'CH2',
      otherEmployee: omar,
      lastMessageIndex: 5,
      lastMessageAt: at(8, 15),
      lastReadIndex: 5,
      preview: { body: 'Thanks, I will sign the chart after lunch.', mine: true },
    },
  },
};

export const conversationState: Partial<EmployeeChatState> = {
  ...listState,
  view: 'conversation',
  activeSid: 'CH1',
  chats: { ...listState.chats!, CH1: { ...listState.chats!.CH1, lastReadIndex: 3 } },
  messages: [
    { sid: 'IM0', index: 0, mine: true, body: 'Is room 3 free yet?', dateCreated: at(9, 30) },
    { sid: 'IM1', index: 1, mine: false, body: 'Almost, cleaning it now.', dateCreated: at(9, 32) },
    { sid: 'IM2', index: 2, mine: true, body: 'Great, my 9:45 just checked in.', dateCreated: at(9, 38) },
    { sid: 'IM3', index: 3, mine: false, body: 'Room 3 is ready for your next patient.', dateCreated: at(9, 41) },
  ],
};

export const employeeChatMocks: FetchMock[] = [
  {
    url: 'get-employees',
    response: {
      status: 200,
      output: {
        employees: [jane, omar].map((employee) => ({ ...employee, status: 'Active', id: employee.profile })),
      },
    },
  },
];
