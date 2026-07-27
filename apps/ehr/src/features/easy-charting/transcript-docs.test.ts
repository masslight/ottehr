import { DocumentReference } from 'fhir/r4b';
import { AIChatDetails } from 'utils';
import { describe, expect, it } from 'vitest';
import {
  containsTranscriptHeader,
  extractTranscriptHeaderLabels,
  hasNewTranscriptDocument,
  transcriptDocumentIds,
  transcriptHeaderLine,
} from './transcript-docs';

const transcriptDoc = (id: string): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  content: [{ attachment: { title: 'Transcript', data: 'dGVzdA==' } }],
});

const aiChat = (documents: DocumentReference[]): AIChatDetails => ({ documents, providers: [] });

describe('transcriptDocumentIds', () => {
  it('returns an empty set for undefined aiChat', () => {
    expect(transcriptDocumentIds(undefined).size).toBe(0);
  });

  it('collects ids of documents with an inline Transcript attachment', () => {
    expect(transcriptDocumentIds(aiChat([transcriptDoc('a'), transcriptDoc('b')]))).toEqual(new Set(['a', 'b']));
  });

  it('ignores documents without a Transcript attachment or without data', () => {
    const audioOnly: DocumentReference = {
      resourceType: 'DocumentReference',
      id: 'audio',
      status: 'current',
      content: [{ attachment: { title: 'Audio recording 0:42' } }],
    };
    const noData: DocumentReference = {
      resourceType: 'DocumentReference',
      id: 'nodata',
      status: 'current',
      content: [{ attachment: { title: 'Transcript' } }],
    };
    expect(transcriptDocumentIds(aiChat([audioOnly, noData])).size).toBe(0);
  });

  it('ignores transcript documents missing an id', () => {
    const noId = { ...transcriptDoc('x'), id: undefined };
    expect(transcriptDocumentIds(aiChat([noId])).size).toBe(0);
  });
});

describe('hasNewTranscriptDocument', () => {
  it('is false when every transcript is already in the baseline', () => {
    expect(hasNewTranscriptDocument(aiChat([transcriptDoc('a')]), new Set(['a']))).toBe(false);
  });

  it('is true when a transcript beyond the baseline appears', () => {
    expect(hasNewTranscriptDocument(aiChat([transcriptDoc('a'), transcriptDoc('b')]), new Set(['a']))).toBe(true);
  });

  it('is false when no transcripts exist at all', () => {
    expect(hasNewTranscriptDocument(aiChat([]), new Set())).toBe(false);
    expect(hasNewTranscriptDocument(undefined, new Set())).toBe(false);
  });
});

describe('transcript header helpers', () => {
  it('round-trips a label through build → extract', () => {
    const label = '🎤 Dr. Jane Smith — 3/14/2026';
    const text = `${transcriptHeaderLine(label)}\nPatient presents with cough.`;
    expect(containsTranscriptHeader(text)).toBe(true);
    expect(extractTranscriptHeaderLabels(text)).toEqual([label]);
  });

  it('extracts every header label in order from a multi-transcript message', () => {
    const text = [
      transcriptHeaderLine('🎤 Dr. A'),
      'first transcript body',
      '',
      transcriptHeaderLine('💬 Chatbot'),
      'second transcript body',
    ].join('\n');
    expect(extractTranscriptHeaderLabels(text)).toEqual(['🎤 Dr. A', '💬 Chatbot']);
  });

  it('finds a header mid-message (composer draft above an inserted transcript)', () => {
    const text = `also add strep test\n\n${transcriptHeaderLine('🎤 Dr. A')}\nbody`;
    expect(containsTranscriptHeader(text)).toBe(true);
  });

  it('reports no headers for plain text, including === used inline', () => {
    expect(containsTranscriptHeader('add diagnosis sinusitis')).toBe(false);
    expect(containsTranscriptHeader('the rash === totally gone by now')).toBe(false);
    expect(extractTranscriptHeaderLabels('add diagnosis sinusitis')).toEqual([]);
  });

  it('tolerates surrounding whitespace and CRLF line endings', () => {
    const text = `  ${transcriptHeaderLine('🎤 Dr. A')}  \r\nbody`;
    expect(extractTranscriptHeaderLabels(text)).toEqual(['🎤 Dr. A']);
  });
});
