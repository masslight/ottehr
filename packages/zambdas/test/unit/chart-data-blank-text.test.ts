import { CommunicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  HISTORY_OBTAINED_FROM_FIELD,
  PATIENT_VACCINATION_STATUS,
} from 'utils/lib/types/data/screening-questions/constants';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';
import { describe, expect, it } from 'vitest';
import { makeCommunicationResource, makeObservationResource } from '../../src/shared/chart-data';

const instruction = (data: CommunicationDTO): ReturnType<typeof makeCommunicationResource> =>
  makeCommunicationResource('enc-1', 'pat-1', data, 'patient-instruction');

const screeningObservation = (data: Record<string, unknown>): ReturnType<typeof makeObservationResource> =>
  makeObservationResource(
    'enc-1',
    'pat-1',
    'prac-1',
    undefined,
    data as unknown as ObservationDTO,
    'additional-questions-field',
    undefined,
    undefined,
    undefined
  );

describe('makeCommunicationResource - patient instruction text', () => {
  it.each([' ', '\n', ' \n\t '])('omits the payload when the instruction text is %j and the title is set', (text) => {
    const resource = instruction({ title: 'Wound care', text });
    expect(resource.payload).toBeUndefined();
    expect(resource.topic).toEqual({ text: 'Wound care' });
  });

  it.each([' ', '\n'])('omits the topic when the title is %j and the instruction text is set', (title) => {
    const resource = instruction({ title, text: 'Drink fluids' });
    expect(resource.topic).toBeUndefined();
    expect(resource.payload).toEqual([{ contentString: 'Drink fluids' }]);
  });

  it('keeps non-blank title and multi-line text exactly as typed', () => {
    const resource = instruction({ title: ' Wound care ', text: '1. Keep dry\n2. Change dressing daily\n' });
    expect(resource.topic).toEqual({ text: ' Wound care ' });
    expect(resource.payload).toEqual([{ contentString: '1. Keep dry\n2. Change dressing daily\n' }]);
  });

  it('keeps an education instruction that has only a title and a document reference', () => {
    const resource = instruction({ title: 'Asthma handout', educationDocRefId: 'doc-1' });
    expect(resource.topic).toEqual({ text: 'Asthma handout' });
    expect(resource.payload).toBeUndefined();
    expect(resource.about).toEqual([{ reference: 'DocumentReference/doc-1' }]);
  });
});

describe('makeObservationResource - screening note', () => {
  it.each([' ', '\n', ' \n '])('omits Observation.note when the note is %j', (note) => {
    const resource = screeningObservation({ field: PATIENT_VACCINATION_STATUS, value: 'partially', note });
    expect(resource.note).toBeUndefined();
    expect(resource.valueString).toBe('partially');
  });

  it('omits Observation.note when the note is cleared to an empty string', () => {
    const resource = screeningObservation({ field: PATIENT_VACCINATION_STATUS, value: 'partially', note: '' });
    expect(resource.note).toBeUndefined();
  });

  it('keeps a non-blank note exactly as typed', () => {
    const note = ' Missing MMR\nbooster due ';
    const resource = screeningObservation({ field: HISTORY_OBTAINED_FROM_FIELD, value: 'not-obtained-other', note });
    expect(resource.note).toEqual([{ text: note }]);
  });
});
