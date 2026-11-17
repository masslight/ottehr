import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { createCommunicationResource } from '../../src/ehr/save-patient-instruction/helpers';

const createTemplate = async (text?: string, title?: string): Promise<Communication> => {
  const create = vi.fn(async (resource: Communication) => resource);
  const oystehr = { fhir: { create } } as unknown as Oystehr;
  return createCommunicationResource({ practitionerProfile: 'Practitioner/prac-1', oystehr, text, title });
};

describe('save-patient-instruction - createCommunicationResource', () => {
  it.each([' ', '\n', ' \n\t'])(
    'omits the payload when the instruction text is %j and the title is set',
    async (text) => {
      const resource = await createTemplate(text, 'Wound care');
      expect(resource.payload).toBeUndefined();
      expect(resource.topic).toEqual({ text: 'Wound care' });
    }
  );

  it.each([' ', '\n'])('omits the topic when the title is %j and the instruction text is set', async (title) => {
    const resource = await createTemplate('Drink fluids', title);
    expect(resource.topic).toBeUndefined();
    expect(resource.payload).toEqual([{ contentString: 'Drink fluids' }]);
  });

  it('keeps non-blank title and multi-line text exactly as typed', async () => {
    const resource = await createTemplate('1. Keep dry\n2. Change dressing daily\n', ' Wound care ');
    expect(resource.topic).toEqual({ text: ' Wound care ' });
    expect(resource.payload).toEqual([{ contentString: '1. Keep dry\n2. Change dressing daily\n' }]);
  });
});
