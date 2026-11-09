import { DiagnosticReport } from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { fetchScopedResources } from '../../../adhoc-report';
import { defineEncounterLayer } from '../context';
import { indexByEncounter, stripEnc } from '../helpers';

// Result reports of the visit.
export const resultsLayer = defineEncounterLayer<{ resultsByEncounterId: Map<string, DiagnosticReport[]> }>({
  id: 'results',
  fetch: async (ctx) => ({
    resultsByEncounterId: indexByEncounter(
      await fetchScopedResources<DiagnosticReport>(ctx.oystehr, 'DiagnosticReport', 'encounter', ctx.encRefs, [
        { name: '_elements', value: 'code,status,meta,encounter' },
      ]),
      (d) => stripEnc(d.encounter?.reference)
    ),
  }),
  map: (input, out) => {
    const { encounter } = input;
    const { resultsByEncounterId } = out;
    const row: Partial<AdHocEncounterRow> = {};
    const drs = encounter.id ? resultsByEncounterId.get(encounter.id) ?? [] : [];
    const resultNames: string[] = [];
    let abnormalResultCount = 0;

    for (const dr of drs) {
      if (dr.status === 'entered-in-error' || dr.status === 'cancelled') continue;

      const name = dr.code?.coding?.find((c) => c.display)?.display || dr.code?.text || '';

      if (name) resultNames.push(name);

      if (dr.meta?.tag?.some((t) => t.code === 'abnormal' || t.code === 'inconclusive')) abnormalResultCount++;
    }

    row.resultNames = resultNames;
    row.resultCount = resultNames.length;
    row.abnormalResultCount = abnormalResultCount;
    return row;
  },
});
