import { Secrets } from 'zambda-utils';

interface LambdaSecrets {
  secrets: Secrets | null;
}

export interface CancelInviteParticipantRequestParameters {
  appointmentId: string;
  emailAddress: string;
}

export type CancelInviteParticipantRequestInput = CancelInviteParticipantRequestParameters & LambdaSecrets;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CancelInviteParticipantResponse {}

export interface ListInvitedParticipantsRequestParameters {
  appointmentId: string;
}

export type ListInvitedParticipantsInput = ListInvitedParticipantsRequestParameters & LambdaSecrets;

export interface InvitedParticipantDTO {
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
}

export type InvitedParticipantInfo = InvitedParticipantDTO;

export interface ListInvitedParticipantsResponse {
  invites: InvitedParticipantDTO[];
}

export interface InviteParticipantRequestParameters {
  appointmentId: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
}

export type VideoChatCreateInviteInput = InviteParticipantRequestParameters & LambdaSecrets;

export interface VideoChatCreateInviteResponse {
  inviteUrl: string;
}
