// Oystehr records telemed audio via the AWS Chime SDK media capture pipeline, which joins the meeting as a
// bot attendee. That attendee's externalUserId contains this marker, letting us hide the recording bot from
// the participant roster shown to providers and patients.
export const MEDIA_CAPTURE_PIPELINE_MARKER = 'MediaPipeline';

export const isRecordingBotParticipant = (externalUserId?: string): boolean =>
  externalUserId?.includes(MEDIA_CAPTURE_PIPELINE_MARKER) ?? false;
