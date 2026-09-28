export interface EmployeeChatParticipant {
  profile: string;
  firstName: string;
  lastName: string;
  name: string;
}

export interface EmployeeChatSummary {
  conversationSid: string;
  otherEmployee: EmployeeChatParticipant;
}

export interface GetEmployeeChatsResponse {
  token: string;
  conversations: EmployeeChatSummary[];
}

export interface OpenEmployeeChatInput {
  targetProfile: string;
}

export interface OpenEmployeeChatResponse {
  conversation: EmployeeChatSummary;
}

export const EMPLOYEE_CHAT_PAIR_SYSTEM = 'https://fhir.ottehr.com/r4/employee-chat-pair';
export const EMPLOYEE_CHAT_CODE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/employee-chat';
export const EMPLOYEE_CHAT_CODE = 'p2p';
export const EMPLOYEE_CHAT_CONVERSATION_SID_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/employee-chat-conversation-sid';
export const EMPLOYEE_CHAT_CONVERSATION_ENCOUNTER_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/employee-chat-conversation-encounter';
