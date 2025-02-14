import { Secrets } from 'zambda-utils';

interface LambdaSecrets {
  secrets: Secrets | null;
}

export interface JoinCallRequestParameters {
  appointmentId: string;
}

export type JoinCallInput = JoinCallRequestParameters & LambdaSecrets;
export type JoinCallResponse = MeetingData;

export interface MeetingData {
  Attendee: object;
  Meeting: object;
}
