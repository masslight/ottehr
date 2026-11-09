import { Appointment, Encounter } from 'fhir/r4b';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { GenerateAdHocReportInputSchema } from 'utils/lib/types/adhoc/generation/generate.types';
import { describe, expect, it, vi } from 'vitest';

const { mockInvokeVertex } = vi.hoisted(() => ({ mockInvokeVertex: vi.fn() }));

vi.mock('../../src/shared/ai', () => ({
  invokeChatbotVertexAI: mockInvokeVertex,
  invokeChatbot: vi.fn(),
}));

import { generateAdHocReportCode } from '../../src/shared/adhoc-generate';
import { resolveEncounterAppointment } from '../../src/shared/adhoc-report';

describe('ad-hoc generation prompt', () => {
  it("keeps the page's date range and gives the model the wording and date-range rules", async () => {
    const parsed = GenerateAdHocReportInputSchema.parse({
      schema: {
        datasetId: 'encounters-comprehensive',
        label: 'Encounters',
        description: '',
        rowCount: 1,
        dateRange: { start: '2026-09-15', end: '2026-10-14' },
        fields: [],
      },
      request: 'count of encounters in discharged status or completed status for each of the past 30 days',
    });
    expect(parsed.schema.dateRange).toEqual({ start: '2026-09-15', end: '2026-10-14' });

    mockInvokeVertex.mockResolvedValue(JSON.stringify({ title: 'T', code: 'return ReportRoot;' }));
    await generateAdHocReportCode(parsed, 'defaultVertexModel', {});
    const prompt = mockInvokeVertex.mock.calls[0][0][0].text as string;

    expect(prompt).toContain("THE REQUEST'S WORDING IS NOT A VALUE");
    expect(prompt).toContain("THE DATE RANGE IS THE PAGE'S");
    expect(prompt).toContain('"start": "2026-09-15"');
    expect(prompt).toContain('"end": "2026-10-14"');
  });
});

describe('resolveEncounterAppointment', () => {
  const parentAppointment: Appointment = {
    resourceType: 'Appointment',
    id: 'appt-1',
    status: 'fulfilled',
    participant: [],
  };
  const parent: Encounter = {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/appt-1' }],
  };
  const encounterById = new Map([['enc-1', parent]]);
  const followUp = (subtype: 'scheduled' | 'annotation', appointment?: string): Encounter => ({
    resourceType: 'Encounter',
    id: 'enc-2',
    status: 'finished',
    class: { code: 'AMB' },
    type: buildFollowupEncounterType(subtype),
    partOf: { reference: 'Encounter/enc-1' },
    ...(appointment ? { appointment: [{ reference: `Appointment/${appointment}` }] } : {}),
  });

  it('a scheduled follow-up outside the range does not take its parent visit', () => {
    const appointments = new Map([['Appointment/appt-1', parentAppointment]]);
    expect(resolveEncounterAppointment(followUp('scheduled', 'appt-2'), appointments, encounterById)).toBeUndefined();
  });

  it('a scheduled follow-up in the range resolves to its own visit', () => {
    const own: Appointment = { resourceType: 'Appointment', id: 'appt-2', status: 'fulfilled', participant: [] };
    const appointments = new Map([
      ['Appointment/appt-1', parentAppointment],
      ['Appointment/appt-2', own],
    ]);
    expect(resolveEncounterAppointment(followUp('scheduled', 'appt-2'), appointments, encounterById)).toBe(own);
  });

  it('a follow-up note still resolves to its parent visit', () => {
    const appointments = new Map([['Appointment/appt-1', parentAppointment]]);
    expect(resolveEncounterAppointment(followUp('annotation'), appointments, encounterById)).toBe(parentAppointment);
  });
});
