import { ReactElement } from 'react';
import ChatModal from 'src/features/chat/ChatModal';
import { AppointmentMessaging, ConversationMessage } from 'utils/lib/types/api/messaging.types';
import { FetchMock } from '../../harness/story';

const appointment: AppointmentMessaging = {
  id: 'appointment-1',
  encounterId: 'encounter-1',
  smsModel: {
    recipients: [{ recipientResourceUri: 'RelatedPerson/related-person-1', smsNumber: '+12125550143' }],
    hasUnreadMessages: false,
  },
  patient: {
    id: 'patient-1',
    firstName: 'John',
    lastName: 'Carter',
    dateOfBirth: '1988-04-12',
    phone: '+12125550143',
  },
} as AppointmentMessaging;

const messages: ConversationMessage[] = [
  {
    id: 'message-1',
    sender: 'Ottehr Team',
    sentDay: '11/12/26',
    sentTime: '9:02 AM',
    content: 'Hi John, your room is ready. Please come to the front desk.',
    isRead: true,
    isFromPatient: false,
  },
  {
    id: 'message-2',
    sender: 'John Carter',
    sentDay: '11/12/26',
    sentTime: '9:04 AM',
    content: 'Thanks, I am parking now and will be there in two minutes.',
    isRead: true,
    isFromPatient: true,
  },
];

export const chatMocks: FetchMock[] = [
  { url: 'get-conversation', response: { status: 200, output: messages } },
  {
    url: 'admin-get-quick-picks',
    response: {
      status: 200,
      output: {
        quickPicks: [
          {
            id: 'quick-text-1',
            name: 'Room ready',
            english: 'Hi {{patient-first-name}}, your room is ready. Please come to the front desk.',
            spanish: 'Hola {{patient-first-name}}, su habitación está lista. Por favor pase a la recepción.',
          },
          {
            id: 'quick-text-2',
            name: 'Running late',
            english: 'We are running about 15 minutes behind. Thank you for your patience.',
            spanish: 'Tenemos un retraso de unos 15 minutos. Gracias por su paciencia.',
          },
          {
            id: 'quick-text-3',
            name: 'Paperwork reminder',
            english: 'Please complete your paperwork before your visit at {{location-name}}.',
          },
        ],
      },
    },
  },
  {
    url: '/user/me',
    response: {
      id: 'user-1',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      roles: [{ id: 'role-1', name: 'Provider' }],
    },
  },
  {
    url: '/messaging/config',
    response: { transactionalSMSConfig: { phoneNumber: '+12125550100' }, conversationConfig: {} },
  },
];

export const ChatHost = (): ReactElement => (
  <ChatModal
    appointment={appointment}
    onClose={() => undefined}
    onMarkAllRead={() => undefined}
    quickTextsContext={{ patientFirstName: 'John', patientLastName: 'Carter', locationName: 'Downtown Clinic' }}
  />
);
