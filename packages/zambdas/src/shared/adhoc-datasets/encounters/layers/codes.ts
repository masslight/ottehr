import { Procedure } from 'fhir/r4b';
import { defineEncounterLayer } from '../context';
import { hasChartTag } from '../helpers';

// Diagnoses (the encounter's ranked Condition references) and the charted CPT / E&M Procedures.
export const codesLayer = defineEncounterLayer<Map<string, Procedure[]>>({
  id: 'codes',
  fetch: async (ctx) => {
    const [procedures] = await Promise.all([ctx.shared.procedures(), ctx.shared.diagnoses()]);
    return procedures;
  },
  map: ({ encounter }, proceduresByEncounterId, ctx) => {
    const icdCodes: string[] = [];
    const icdDisplays: string[] = [];
    let primaryIcd = '';
    let primaryIcdDisplay = '';
    const dxEntries = [...(encounter.diagnosis ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

    for (const dx of dxEntries) {
      const conditionId = dx.condition?.reference?.replace('Condition/', '');
      const condition = conditionId ? ctx.conditions.map.get(conditionId) : undefined;
      const codings = condition?.code?.coding ?? [];
      const icdCoding = codings.find((c) => c.system?.toLowerCase().includes('icd-10')) ?? codings[0];
      const code = icdCoding?.code;
      const display = icdCoding?.display ?? condition?.code?.text ?? code;

      if (code && !icdCodes.includes(code)) {
        icdCodes.push(code);
        icdDisplays.push(display ?? code);
      }

      // The chart marks the primary diagnosis with rank 1 (DiagnosisDTO.isPrimary).
      if (code && dx.rank === 1 && !primaryIcd) {
        primaryIcd = code;
        primaryIcdDisplay = display ?? code;
      }
    }

    const cptCodes: string[] = [];
    const cptDisplays: string[] = [];
    let emCode: string | undefined;
    let emDisplay: string | undefined;

    for (const procedure of encounter.id ? proceduresByEncounterId.get(encounter.id) ?? [] : []) {
      const coding = procedure.code?.coding?.[0];
      const code = coding?.code;
      if (!code) continue;
      const display = coding?.display ?? procedure.code?.text ?? code;
      if (hasChartTag(procedure, 'em-code')) {
        if (!emCode) {
          emCode = code;
          emDisplay = display;
        }
      } else if (hasChartTag(procedure, 'cpt-code') && !cptCodes.includes(code)) {
        cptCodes.push(code);
        cptDisplays.push(display);
      }
    }

    return {
      icdCodes,
      icdDisplays,
      primaryIcd,
      primaryIcdDisplay,
      cptCodes,
      cptDisplays,
      emCode: emCode ?? '',
      emDisplay: emDisplay ?? '',
    };
  },
});
