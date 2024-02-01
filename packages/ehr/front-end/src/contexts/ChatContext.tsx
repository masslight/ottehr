/* eslint-disable @typescript-eslint/no-empty-function */
import React, { createContext, FC, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Conversation, Message, Participant, Client as TwilioClient } from '@twilio/conversations';
import { getTokenForConversation } from '../api/api';
import { AppointmentInformation } from '../types/types';
import { useZambdaClient } from '../hooks/useZambdaClient';
import { IntakeDataContext } from '../store/IntakeContext';
import { messageIsFromPatient } from '../helpers';

enum ConvoLoadingState {
  initial,
  loading,
  idle,
}

enum TwilioLoadingState {
  initial,
  loading,
  error,
  complete,
}

interface TwilioConversationWithInitialMessages {
  id: string;
  conversation: Conversation;
  messages: Message[];
  newMessagesStartIndex: number | undefined;
  hasUnreadMessages: boolean;
}

type ChatModel = Omit<TwilioConversationWithInitialMessages, 'id'>;

type ChatModelMap = { [key: string]: ChatModel };

interface PatientParticipant {
  firstName: string;
  name: string;
  initials: string;
  phoneNumber: string | undefined;
  appointmentId: string;
}

interface CurrentChatModel extends Omit<ChatModel, 'conversation'> {
  // messages: Message[] >> inherited from ChatModel
  patientParticipant: PatientParticipant;
  sendMessage: (messge: string) => Promise<void>;
}

type ChatContextProps = {
  chatIsLoading: boolean;
  currentOpenChat: CurrentChatModel | undefined;
  chatModalOpen: boolean;
  getConversation: (convoId: string) => ChatModel | undefined;
  openChat: (appointmentId: string) => void;
  closeChat: () => void;
};

export const ChatContext = createContext<ChatContextProps>({
  chatIsLoading: false,
  currentOpenChat: undefined,
  chatModalOpen: false,
  getConversation: (_convoId: string) => undefined,
  openChat: (_appointmentId: string) => {},
  closeChat: () => {},
});

interface ClientTemp {
  twilioClient: TwilioClient;
  idTemp: number | undefined;
}

interface ChatProviderProps {
  appointments: AppointmentInformation[];
  children: ReactNode;
}
export const ChatProvider: FC<ChatProviderProps> = ({ children, appointments }) => {
  const zambdaClient = useZambdaClient();
  const { state } = useContext(IntakeDataContext);
  const [clientLoadingState, setClientLoadingState] = useState<TwilioLoadingState>(TwilioLoadingState.initial);
  const [convoLoadingState, setConvoLoadingState] = useState<ConvoLoadingState>(ConvoLoadingState.idle);
  const [twilioClients, setTwilioClients] = useState<ClientTemp[] | undefined>(undefined);
  const [conversationsMap, setConversationsMap] = useState<ChatModelMap>({});
  const [selectedAppointmentForChat, setSelectedAppointmentForChat] = useState<AppointmentInformation | undefined>(
    undefined,
  );
  const [conversationPerson, setConversationPerson] = useState<{ [conversationID: string]: string }>({});

  useEffect(() => {
    if (appointments.length >= 0) {
      // console.log('appointments.length', appointments.length);
      setConvoLoadingState(ConvoLoadingState.initial);
    }

    appointments.forEach((appointmentTemp) => {
      const conversationSID = appointmentTemp.conversationModel?.conversationSID;
      if (conversationSID && conversationPerson && !conversationPerson[conversationSID]) {
        const temp = conversationPerson;
        temp[conversationSID] = appointmentTemp.personID;
        console.log(4, temp);
        setConversationPerson(temp);
      }
    });
  }, [appointments, conversationPerson]);

  const conversationIds = useMemo(() => {
    return appointments
      .filter((app) => app.conversationModel !== undefined)
      .map((app) => {
        const model = app.conversationModel as { conversationSID: string };
        return model.conversationSID;
      });
  }, [appointments]);

  const getConversation = useCallback(
    (convoId: string): ChatModel | undefined => {
      return conversationsMap[convoId];
    },
    [conversationsMap],
  );

  const sendMessage = useCallback(
    async (conversation: Conversation, message: string) => {
      await conversation.sendMessage(message, {
        senderName: state.user?.name || 'Unknown',
        senderID: state.user?.id || 'Unknown',
      });
    },
    [state.user?.name, state.user?.id],
  );

  const currentOpenChat: CurrentChatModel | undefined = useMemo(() => {
    if (!selectedAppointmentForChat || !selectedAppointmentForChat.conversationModel) {
      return undefined;
    }
    const { conversationSID } = selectedAppointmentForChat.conversationModel;
    const model = getConversation(conversationSID);
    if (!model) {
      return undefined;
    }
    const { messages, conversation, hasUnreadMessages, newMessagesStartIndex } = model;
    const patientParticipant = getPatientParticipantFromAppointmentAndConvo(selectedAppointmentForChat, conversation);
    // console.log('returning current open chat');
    return {
      messages,
      patientParticipant,
      hasUnreadMessages,
      newMessagesStartIndex,
      sendMessage: (messge: string) => {
        return sendMessage(conversation, messge);
      },
    };
  }, [selectedAppointmentForChat, getConversation, sendMessage]);

  useEffect(() => {
    // console.log(conversationsMap.length, twilioClients)
    twilioClients?.forEach((twilioClientTemp) => {
      const twilioClient = twilioClientTemp.twilioClient;
      if (twilioClient) {
        twilioClient?.removeAllListeners('messageAdded');
        twilioClient?.removeAllListeners('conversationUpdated');
        if (Object.keys(conversationsMap).length >= 0) {
          twilioClient.addListener('messageAdded', (message: Message) => {
            const convoId = message.conversation.sid;
            const conversationModel = conversationsMap[convoId];
            if (conversationModel) {
              conversationModel.messages = [...conversationModel.messages, message];
              if (messageIsFromPatient(message)) {
                conversationModel.hasUnreadMessages = true;
                if (conversationModel.newMessagesStartIndex === undefined) {
                  conversationModel.newMessagesStartIndex = message.index;
                }
              } else {
                conversationModel.newMessagesStartIndex = undefined;
              }
              setConversationsMap({ ...conversationsMap });
            }
          });
          twilioClient.addListener('conversationUpdated', ({ conversation, updateReasons }) => {
            if (updateReasons.some((ur) => ur === 'lastReadMessageIndex')) {
              const convoId = conversation.sid;
              const conversationModel = conversationsMap[convoId];
              if (conversationModel) {
                conversationModel.hasUnreadMessages = false;
                conversationModel.newMessagesStartIndex = undefined;
                setConversationsMap({ ...conversationsMap });
              }
            }
          });
        }
      }
    });
  }, [conversationsMap, twilioClients]);

  useEffect(() => {
    async function initTwilioClient(): Promise<void> {
      if (!zambdaClient) {
        return;
      }

      if (twilioClients) {
        return;
      }

      setClientLoadingState(TwilioLoadingState.loading);

      try {
        const messagingTokenTemp = await getTokenForConversation(zambdaClient);
        const clients = [];
        clients.push({ twilioClient: new TwilioClient(messagingTokenTemp.token), idTemp: undefined });
        for (let i = 1; i <= Object.keys(messagingTokenTemp).length - 1; i++) {
          clients.push({ twilioClient: new TwilioClient(messagingTokenTemp[`token-${i}`]), idTemp: i });
        }
        setTwilioClients(clients);
        setClientLoadingState(TwilioLoadingState.complete);
      } catch (e) {
        console.log(e);
        setClientLoadingState(TwilioLoadingState.error);
      }
    }
    if (clientLoadingState === TwilioLoadingState.initial) {
      void initTwilioClient();
    }
  });

  useEffect(() => {
    const initTwilioConversations = async (convoIds: string[], clients: ClientTemp[]): Promise<void> => {
      setConvoLoadingState(ConvoLoadingState.loading);
      const dedupedConvoIds = Array.from(new Set(convoIds));

      const convoPromises: Array<Promise<TwilioConversationWithInitialMessages | undefined>> = dedupedConvoIds.map(
        (id) => {
          const promise = async (): Promise<TwilioConversationWithInitialMessages | undefined> => {
            try {
              // const client = clients.find((clientTemp) => clientTemp.get)
              if (!conversationPerson) {
                console.log('conversationperson is not found');
                return;
              }
              const conversationTemp = Object.keys(conversationPerson)?.find(
                (conversationTemp) => conversationTemp === id,
              );
              if (!conversationTemp) {
                console.log('conversationTemp is not found');
                return;
              }

              const person = conversationPerson[conversationTemp];
              const messagingNumber = (parseInt(person.replace('-', ''), 16) % 20) + 1;

              let client = clients.find((clientTemp) => clientTemp.idTemp === messagingNumber)?.twilioClient;
              if (!client) {
                console.log('client is not found');
                return;
              }
              let conversation;
              try {
                conversation = await client.getConversationBySid(id);
              } catch (error) {
                client = clients.find((clientTemp) => clientTemp.idTemp === undefined)?.twilioClient;
                if (!client) {
                  console.log('client is not found');
                  return;
                }
                conversation = await client.getConversationBySid(id);
              }
              const initialMessages = await conversation.getMessages();
              const unreadCount = await conversation.getUnreadMessagesCount();
              const hasUnreadMessages = unreadCount ? unreadCount > 0 : false;
              return {
                id,
                conversation,
                messages: initialMessages.items,
                hasUnreadMessages: hasUnreadMessages,
                newMessagesStartIndex: getNewMessagesStartIndex(conversation, initialMessages.items),
              };
            } catch (e) {
              console.log('promise failed!', e);
              return undefined;
            }
          };
          return promise();
        },
      );
      const convos: TwilioConversationWithInitialMessages[] = (await Promise.all(convoPromises)).filter((item) => {
        return item !== undefined;
      }) as TwilioConversationWithInitialMessages[];

      const convoMap = convos.reduce((accum, current) => {
        const { id, conversation, messages, hasUnreadMessages, newMessagesStartIndex } = current;
        accum[id] = { conversation, messages, hasUnreadMessages, newMessagesStartIndex };
        return accum;
      }, {} as ChatModelMap);
      setConversationsMap(convoMap);
      setConvoLoadingState(ConvoLoadingState.idle);
    };
    if (twilioClients && conversationIds.length >= 0 && convoLoadingState === ConvoLoadingState.initial) {
      void initTwilioConversations(conversationIds, twilioClients);
    }
  }, [conversationIds, conversationPerson, convoLoadingState, twilioClients]);

  const openChat = useCallback(
    (appointmentId: string) => {
      const appointmentSelected = appointments.find((appointment) => {
        return appointment.id === appointmentId && appointment.conversationModel !== undefined;
      });
      setSelectedAppointmentForChat(appointmentSelected);
    },
    [appointments],
  );

  const closeChat = useCallback((): void => {
    if (!selectedAppointmentForChat || !selectedAppointmentForChat.conversationModel) {
      return undefined;
    }
    const { conversationSID } = selectedAppointmentForChat.conversationModel;
    const model = getConversation(conversationSID);
    if (model) {
      void model.conversation?.setAllMessagesRead();
    }
    setSelectedAppointmentForChat(undefined);
  }, [getConversation, selectedAppointmentForChat]);

  const contextValue = {
    chatIsLoading: clientLoadingState === TwilioLoadingState.loading || convoLoadingState === ConvoLoadingState.loading,
    currentOpenChat,
    chatModalOpen: currentOpenChat !== undefined,
    getConversation,
    closeChat,
    openChat,
  };
  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

export function useChat(): ChatContextProps {
  return useContext(ChatContext);
}

export const useHasUnreadMessage = (conversationId: string): boolean => {
  const { getConversation } = useChat();

  return useMemo(() => {
    const model = getConversation(conversationId);
    if (!model) {
      return false;
    }
    const { hasUnreadMessages } = model;
    return hasUnreadMessages;
  }, [conversationId, getConversation]);
};

const getParticipantPhoneNumberFromConversation = (conversation: Conversation): string | undefined => {
  const participants = conversation._participants;
  if (!participants) {
    return;
  }
  let phoneNumber: string | undefined;
  Array.from(participants.values()).forEach((participant) => {
    const phoneNumberTemp = (participant.bindings as any)?.sms?.address;
    if (phoneNumberTemp) {
      phoneNumber = phoneNumberTemp;
    }
  });
  return phoneNumber;
};

const getPatientParticipantFromAppointmentAndConvo = (
  appointment: AppointmentInformation,
  conversation: Conversation,
): PatientParticipant => {
  const initials = `${appointment.patient.firstName.charAt(0)} ${appointment.patient.lastName.charAt(0)}`;
  const firstName = appointment.patient.firstName;
  const name = `${appointment.patient.firstName} ${appointment.patient.lastName}`;

  return {
    firstName,
    name,
    initials,
    phoneNumber: getParticipantPhoneNumberFromConversation(conversation),
    appointmentId: appointment.id,
  };
};

const lastReadIndexForNonPatientParticipant = (conversation: Conversation): number | undefined => {
  const participant: Participant = Object.values(conversation._participants).find((participant) => {
    const phoneNumber = (participant.bindings as any)?.sms?.address;
    return !phoneNumber;
  });
  if (participant) {
    return participant.lastReadMessageIndex ?? undefined;
  }
  return undefined;
};

const getNewMessagesStartIndex = (conversation: Conversation, messages: Message[]): number | undefined => {
  const lastReadIndex = lastReadIndexForNonPatientParticipant(conversation);
  if (lastReadIndex === undefined) {
    return undefined;
  }
  const firstUnreadMessageFromPatient = messages.find((message) => {
    if (message.index <= lastReadIndex) {
      return false;
    }
    if (!messageIsFromPatient(message)) {
      return false;
    }
    return true;
  });
  return firstUnreadMessageFromPatient?.index;
};
