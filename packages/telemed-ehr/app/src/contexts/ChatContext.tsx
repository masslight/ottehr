/* eslint-disable @typescript-eslint/no-empty-function */
import { Conversation, Message, Participant, Client as TwilioClient } from '@twilio/conversations';
import { FC, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getTokensForConversations } from '../api/api';
import { messageIsFromPatient } from '../helpers';
import { useApiClients } from '../hooks/useAppClients';
import { useCommonStore } from '../state/common.store';
import { AppointmentInformation, TwilioConversationModel } from '../types/types';

enum ConvoLoadingState {
  initial,
  loading,
  idle,
}

enum TwilioLoadingState {
  initial,
  loading,
  error,
  refreshed,
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

interface ChatProviderProps {
  appointments: AppointmentInformation[];
  children: ReactNode;
}

interface ConvoInitPair {
  conversationSID: string;
  clientPairing: number;
}

const dedupeConvos = (conversationInits: ConvoInitPair[]): ConvoInitPair[] => {
  // tbh, conversationSID:client pairing should always be 1:1, so this is a bit of future proofing
  const mapped = conversationInits.map((ci) => `${ci.conversationSID}|${ci.clientPairing}`);
  const dedupedStrings = Array.from(new Set(mapped));
  const deduped = dedupedStrings.map((st) => {
    const [conversationSID, clientPairingString] = st.split('|');
    return { conversationSID, clientPairing: parseInt(clientPairingString) };
  });

  return deduped;
};

const isConnectionNotInitializedFailure = (error: any): boolean => {
  if (typeof error === 'string') {
    const errorString = error as string;
    return errorString.toLowerCase().includes('connection is not initialized');
  } else if (typeof error === 'object') {
    const { message } = error;
    if (message !== undefined) {
      return isConnectionNotInitializedFailure(message);
    }
  }
  return false;
};

const shutdownClients = async (clients: TwilioClient[]): Promise<void> => {
  await Promise.all(clients.map((client) => client.shutdown()));
};

export const ChatProvider: FC<ChatProviderProps> = ({ children, appointments }) => {
  const { zambdaClient } = useApiClients();
  const [clientLoadingState, setClientLoadingState] = useState<TwilioLoadingState>(TwilioLoadingState.initial);
  const [convoLoadingState, setConvoLoadingState] = useState<ConvoLoadingState>(ConvoLoadingState.idle);
  const [twilioClients, setTwilioClients] = useState<TwilioClient[] | null>(null);
  const [conversationsMap, setConversationsMap] = useState<ChatModelMap>({});
  const [selectedAppointmentForChat, setSelectedAppointmentForChat] = useState<AppointmentInformation | undefined>(
    undefined,
  );
  const user = useCommonStore((state) => state.user);

  const resetClients = useCallback(async () => {
    try {
      await shutdownClients(twilioClients ?? []);
    } catch (e) {
      console.log('error shutting down clients', e);
    }
    setConversationsMap({});
    setTwilioClients(null);
    setClientLoadingState(TwilioLoadingState.initial);
    setConvoLoadingState(ConvoLoadingState.initial);
  }, [twilioClients]);

  const conversationIds: ConvoInitPair[] = useMemo(() => {
    return dedupeConvos(
      appointments
        .filter((app) => app.conversationModel !== undefined)
        .map((app) => {
          const model = app.conversationModel as TwilioConversationModel;
          return { conversationSID: model.conversationSID, clientPairing: model.clientPairing };
        }),
    );
  }, [appointments]);

  useEffect(() => {
    if (clientLoadingState !== TwilioLoadingState.error) {
      setConvoLoadingState(ConvoLoadingState.initial);
    }
  }, [clientLoadingState, conversationIds]);

  useEffect(() => {
    const loadConvos = async (convoIds: ConvoInitPair[], clients: TwilioClient[]): Promise<void> => {
      if (convoLoadingState === ConvoLoadingState.loading) {
        return;
      }
      // console.log('loading convos');
      setConvoLoadingState(ConvoLoadingState.loading);
      const dedupedConvoIds = dedupeConvos(convoIds).filter((convoIdPair) => {
        const { conversationSID } = convoIdPair;
        return !new Set(Object.keys(conversationsMap)).has(conversationSID);
      });
      const convoPromises: Array<
        Promise<TwilioConversationWithInitialMessages | { needClientReinit: true } | undefined>
      > = dedupedConvoIds.map((pair) => {
        const { conversationSID: id, clientPairing: messagingNumber } = pair;
        const promise = async (): Promise<
          TwilioConversationWithInitialMessages | { needClientReinit: true } | undefined
        > => {
          try {
            // console.log('messaging number:', messagingNumber);
            let client = clients[messagingNumber];
            if (!client) {
              console.log('client is not found', client);
              return;
            }
            let conversation;
            try {
              conversation = await client.getConversationBySid(id);
            } catch (error) {
              // console.log('error getting conversation - falling back on default client', error);
              client = clients[0];
              if (!client) {
                console.log('client is not found');
                return;
              }
              conversation = await client.getConversationBySid(id);
              // console.log('conversation successfully loaded with default client');
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
            console.log(`promise failed for id (${id}) messagingNumber (${messagingNumber})!`, e);
            if (isConnectionNotInitializedFailure(e)) {
              return { needClientReinit: true };
            }
            return undefined;
          }
        };
        return promise();
      });

      const maybeConvos = (await Promise.all(convoPromises)).filter((item) => {
        return item !== undefined;
      });

      // hacky recovery for when some conversation clients are in "not initialized" state, which
      // happens from time to time and have not found a better solution for it
      let needsReset = false;
      maybeConvos.forEach((val) => {
        const { needClientReinit } = val as any;
        if (needClientReinit === true) {
          needsReset = true;
        }
      });
      if (needsReset) {
        await resetClients();
        return;
      }

      const convos = maybeConvos as TwilioConversationWithInitialMessages[];

      const convoMap = convos.reduce((accum, current) => {
        const { id, conversation, messages, hasUnreadMessages, newMessagesStartIndex } = current;
        accum[id] = { conversation, messages, hasUnreadMessages, newMessagesStartIndex };
        return accum;
      }, {} as ChatModelMap);
      setConversationsMap({ ...conversationsMap, ...convoMap });
      setConvoLoadingState(ConvoLoadingState.idle);
    };
    if (
      convoLoadingState === ConvoLoadingState.initial &&
      twilioClients !== null &&
      clientLoadingState === TwilioLoadingState.complete
    ) {
      void loadConvos(conversationIds, twilioClients);
    }
  }, [clientLoadingState, conversationIds, convoLoadingState, twilioClients, conversationsMap, resetClients]);

  const getConversation = useCallback(
    (convoId: string): ChatModel | undefined => {
      return conversationsMap[convoId];
    },
    [conversationsMap],
  );

  const sendMessage = useCallback(
    async (conversation: Conversation, message: string) => {
      await conversation.sendMessage(message, {
        senderName: user?.name || 'Unknown',
        senderID: user?.id || 'Unknown',
      });
    },
    [user?.name, user?.id],
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
    // console.log(conversationsMap.length, twilioClients);
    twilioClients?.forEach((twilioClient) => {
      if (twilioClient) {
        twilioClient?.removeAllListeners('messageAdded');
        twilioClient?.removeAllListeners('conversationUpdated');
        twilioClient?.removeAllListeners('connectionError');
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
          twilioClient.addListener('connectionError', (error) => {
            const { terminal, message } = error;
            console.log('connection error from twilio: ', { terminal, message });
            if (terminal) {
              void resetClients();
            }
          });
        }
      }
    });
  }, [conversationsMap, resetClients, twilioClients]);

  useEffect(() => {
    async function initClients(): Promise<void> {
      if (!zambdaClient) {
        console.log('no zambda client');
        return;
      }
      // console.log('fetching twilio tokens');
      setClientLoadingState(TwilioLoadingState.loading);

      try {
        // console.log('initializing twilio clients');
        const messagingTokens = await getTokensForConversations(zambdaClient);
        if (messagingTokens && messagingTokens.length) {
          const newClients: TwilioClient[] = Array(messagingTokens.length);
          messagingTokens.forEach((token, idx) => {
            newClients[idx] = new TwilioClient(token);
          });
          setTwilioClients(newClients);
          setClientLoadingState(TwilioLoadingState.complete);
          setConvoLoadingState(ConvoLoadingState.initial);
        }
      } catch (e) {
        console.log(e);
        setClientLoadingState(TwilioLoadingState.error);
      }
    }
    if (clientLoadingState === TwilioLoadingState.initial) {
      // console.log('fetching client tokens');
      void initClients();
    }
    return () => {
      void shutdownClients(twilioClients ?? []);
    };
  }, [clientLoadingState, twilioClients, zambdaClient]);

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
