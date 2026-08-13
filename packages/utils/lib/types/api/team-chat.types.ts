export interface TeamChatAccessResponse {
  conversationId: string;
  token: string;
}

// Identifier stamped on the singleton Encounter that anchors the staff team chat
// Conversation. The Oystehr Conversations service requires an Encounter per
// Conversation; this identifier is how the team-chat-access zambda finds it.
export const TEAM_CHAT_ENCOUNTER_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/r4/team-chat';
export const TEAM_CHAT_ENCOUNTER_IDENTIFIER_VALUE = 'team-chat-room';
