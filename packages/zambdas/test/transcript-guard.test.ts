import { describe, expect, it } from 'vitest';
import { removeTranscriptLoop, TRANSCRIPT_LOOP_NOTE, withoutLeadingTime } from '../src/shared/transcript-guard';

describe('removeTranscriptLoop', () => {
  it('leaves a normal transcript alone', () => {
    const transcript = '0:01 Provider: How are you?\n0:03 Patient: Okay. Uh-huh. Uh-huh.\n0:05 Provider: Good.';
    expect(removeTranscriptLoop(transcript)).toEqual({ transcript, looped: false });
  });

  it('cuts a phrase repeated within a line back to one copy', () => {
    const transcript = `4:15 Patient: It started yesterday.\n4:19 Provider: ${'Uh-huh. '.repeat(16000)}`;
    const result = removeTranscriptLoop(transcript);
    expect(result.looped).toBe(true);
    expect(result.transcript).toBe(
      `4:15 Patient: It started yesterday.\n4:19 Provider: Uh-huh.\n${TRANSCRIPT_LOOP_NOTE}`
    );
  });

  it('cuts repeated lines back to one, ignoring their times and speakers', () => {
    const repeats = Array.from({ length: 12 }, (_, i) => `4:${20 + i} ${i % 2 ? 'Patient' : 'Provider'}: Uh-huh.`);
    const result = removeTranscriptLoop(['4:15 Patient: It started yesterday.', ...repeats].join('\n'));
    expect(result.looped).toBe(true);
    expect(result.transcript).toBe(
      `4:15 Patient: It started yesterday.\n4:20 Provider: Uh-huh.\n${TRANSCRIPT_LOOP_NOTE}`
    );
  });

  it('keeps a few repeats that are real speech', () => {
    const transcript = Array.from({ length: 4 }, (_, i) => `0:0${i} Patient: No.`).join('\n');
    expect(removeTranscriptLoop(transcript).looped).toBe(false);
  });
});

describe('withoutLeadingTime', () => {
  it('finds the no-speech answer with or without a time', () => {
    expect(withoutLeadingTime('NO_SPEECH_DETECTED\n')).toBe('NO_SPEECH_DETECTED');
    expect(withoutLeadingTime('0:00 NO_SPEECH_DETECTED')).toBe('NO_SPEECH_DETECTED');
  });
});
