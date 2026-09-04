import { DETAILS_FIELD_LABEL, TO_DETAILS, whereClauseFor } from '../family-support';
import { WhereToDocument } from '../model.types';
import { SplintingFacts, SplintRegion, StrappingRegion, StrapSiteRegion } from './splinting.extract';

export type { SplintingFacts, SplintRegion, StrappingRegion, StrapSiteRegion };

export const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  applianceKind: {
    destination: TO_DETAILS,
    example: '"short arm splint molded and applied" or "ankle strapping applied"',
  },
  splintType: {
    destination: `${TO_DETAILS} (or a Technique value)`,
    example: '"short arm volar splint" or "long leg posterior splint"',
  },
  staticDynamic: { destination: TO_DETAILS, example: '"static splint" or "dynamic (hinged) splint"' },
  strapSite: { destination: 'in the Site/location field, or name the strapped region in Procedure details' },
  laterality: { destination: 'in the Side of body field' },
  material: { destination: 'in the Supplies used field, or name it in Procedure details', example: '"fiberglass"' },
  application: {
    destination: `in the Performed by / Documented by fields, or state it in ${DETAILS_FIELD_LABEL}`,
    example: '"splint molded and applied by me"',
  },
  preNeurovascular: {
    destination: TO_DETAILS,
    example: '"pre-application: 2+ radial pulse, brisk cap refill, motor and sensation intact"',
  },
  postNeurovascular: {
    destination: TO_DETAILS,
    example: '"post-application: pulses, motor, and sensation intact; cap refill <2 s"',
  },
  neurovascularTiming: {
    destination: TO_DETAILS,
    example:
      '"pre-application: pulses 2+, sensation intact" and "post-application: pulses, motor, and sensation intact"',
  },
  instructions: {
    destination: `in the Post-procedure instructions field, or note them in ${DETAILS_FIELD_LABEL}`,
    example: '"splint care and elevation reviewed"',
  },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);
