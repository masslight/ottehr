import { ServiceRequest } from 'fhir/r4b';
import { dispositionCheckboxOptions, mapDispositionTypeToLabel } from 'utils/lib/fhir/disposition';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import {
  DispositionType,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  REFUSAL_OF_EMS_TRANSPORT_FIELD,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { knownValueOrNull } from '../../../adhoc-report';
import { followUpTypeFromPerformerType, makeDispositionDTOFromFhirResources } from '../../../chart-data';
import { defineEncounterLayer } from '../context';
import { hasChartTag, isActiveOrder } from '../helpers';

// The chart's disposition and the follow-up orders of the visit.
export const dispositionLayer = defineEncounterLayer<{ serviceRequestsByEncounterId: Map<string, ServiceRequest[]> }>({
  id: 'disposition',
  fetch: async (ctx) => ({ serviceRequestsByEncounterId: await ctx.shared.serviceRequests() }),
  map: (input, out) => {
    const { encounter } = input;
    const { serviceRequestsByEncounterId } = out;
    const srs = (encounter.id ? serviceRequestsByEncounterId.get(encounter.id) ?? [] : []).filter(isActiveOrder);
    const row: Partial<AdHocEncounterRow> = {};
    const followUpTypes = srs
      .filter((sr) => hasChartTag(sr, 'sub-follow-up'))
      .map((sr) => {
        const type = followUpTypeFromPerformerType(sr.performerType);
        if (!type) return '';
        return dispositionCheckboxOptions.find((o) => o.name === type)?.label ?? type;
      })
      .filter(Boolean);

    row.followUpTypes = followUpTypes;
    row.followUpCount = followUpTypes.length;

    row.dischargeDisposition =
      encounter.hospitalization?.dischargeDisposition?.coding?.[0]?.display ||
      encounter.hospitalization?.dischargeDisposition?.text ||
      '';

    // The chart's disposition, read with the chart's own DTO builder (Encounter.hospitalization + the
    // disposition-follow-up ServiceRequest).
    const disposition = makeDispositionDTOFromFhirResources(
      encounter,
      encounter.id ? serviceRequestsByEncounterId.get(encounter.id) ?? [] : []
    );

    const dispositionType = knownValueOrNull(
      Object.keys(mapDispositionTypeToLabel) as DispositionType[],
      disposition?.type
    );

    row.dispositionType = dispositionType;
    row.dispositionLabel = dispositionType ? mapDispositionTypeToLabel[dispositionType] : '';
    row.followUpInDays = disposition?.followUpIn ?? null;
    row.transferReason = disposition?.reason ?? '';
    row.transferSpecialty = disposition?.specialty ?? '';
    row.transferSpecialtyOther = disposition?.specialtyOther ?? '';
    row.dispositionLabServices = disposition?.labService ?? [];
    row.dispositionVirusTests = disposition?.virusTest ?? [];
    row.nothingToEatOrDrink = disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ?? false;
    row.refusalOfEmsTransport = disposition?.[REFUSAL_OF_EMS_TRANSPORT_FIELD] ?? false;
    return row;
  },
});
