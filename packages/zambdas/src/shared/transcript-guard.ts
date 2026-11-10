/**
 * Transcription can get stuck repeating a short phrase ("Uh-huh. Uh-huh. ...") until the model's output limit.
 * The timestamped prompt makes that rare but can't rule it out, so the transcript is checked and a loop is cut
 * back to its first copy before anything downstream (AI suggestions, AutoChart) reads it.
 */

/** Phrases at most this many words long are loop candidates. */
const MAX_LOOP_PHRASE_WORDS = 3;
/** A phrase repeated back to back at least this many times is a loop, not speech. */
const MIN_LOOP_REPEATS = 10;

export const TRANSCRIPT_LOOP_NOTE = '[Transcript stopped here: the transcription repeated itself and was cut off.]';

const LINE_PREFIX = /^\s*[[(]?\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?[\])]?\s*[-–]?\s*(?:[A-Za-z][\w ]{0,20}:\s*)?/;
const REPEATED_PHRASE = new RegExp(
  `((?:\\b[\\w'-]+[.,!?]?\\s+){1,${MAX_LOOP_PHRASE_WORDS}}?)\\1{${MIN_LOOP_REPEATS - 1},}`
);

/** A line's words without its leading time and speaker label, for comparing lines. */
const lineSpeech = (line: string): string => line.replace(LINE_PREFIX, '').trim().toLowerCase();

/** Index of the first line of a run of identical lines (ignoring times and speakers), or -1. */
function findRepeatedLines(lines: string[]): number {
  let runStart = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lineSpeech(lines[i]) !== lineSpeech(lines[runStart]) || !lineSpeech(lines[i])) runStart = i;
    else if (i - runStart + 1 >= MIN_LOOP_REPEATS) return runStart;
  }
  return -1;
}

export interface GuardedTranscript {
  transcript: string;
  looped: boolean;
}

/** Cuts a repetition loop back to its first copy and marks where the transcript stops. */
export function removeTranscriptLoop(transcript: string): GuardedTranscript {
  const lines = transcript.split('\n');
  const lineLoop = findRepeatedLines(lines);
  if (lineLoop >= 0) {
    return { transcript: [...lines.slice(0, lineLoop + 1), TRANSCRIPT_LOOP_NOTE].join('\n'), looped: true };
  }
  const phraseLoop = REPEATED_PHRASE.exec(transcript);
  if (phraseLoop) {
    const kept = transcript.slice(0, phraseLoop.index) + phraseLoop[1].trimEnd();
    return { transcript: `${kept}\n${TRANSCRIPT_LOOP_NOTE}`, looped: true };
  }
  return { transcript, looped: false };
}

/** The transcript text without a leading time, so a timestamped "0:00 NO_SPEECH_DETECTED" still matches. */
export const withoutLeadingTime = (transcript: string): string => transcript.replace(LINE_PREFIX, '').trim();
