import { DateTime } from 'luxon';
import { getRulesData, RulesData } from 'utils/lib/immunization-forecast/data/rules-data';
import { medicationApplianceRoutes } from 'utils/lib/types/api/medication-administration.types';
import { ImmunizationCptCode } from 'utils/lib/types/data/immunization/types';
import { RSV_MONOCLONAL_ANTIBODY_CVX_CODES } from 'utils/lib/types/data/immunization/vfc';
import { ImmunizationFormValues } from './immunizationLines';

/** Where a line's CPT codes came from: suggested by the page, a quick pick's, or typed by a person. A person's edit
 * is kept for good; a quick pick's codes are never changed. */
export type CptOrigin = 'suggested' | 'quickpick' | 'manual';

const ADMIN_CODE_DISPLAY: Record<string, string> = {
  '90460': 'Immunization admin through 18 years with counseling, first component',
  '90461': 'Immunization admin through 18 years with counseling, each additional component',
  '90471': 'Immunization admin, injection, first vaccine',
  '90472': 'Immunization admin, injection, each additional vaccine',
  '90473': 'Immunization admin, intranasal or oral, first vaccine',
  '90474': 'Immunization admin, intranasal or oral, each additional vaccine',
  '96380': 'RSV monoclonal antibody admin, IM, with counseling',
  '96381': 'RSV monoclonal antibody admin, IM',
};
const FIRST_ADMIN_CODES = ['90471', '90473'];
const NASAL_OR_ORAL_ROUTES = [medicationApplianceRoutes.NASAL.code, medicationApplianceRoutes.ORAL.code];

const adminCode = (code: string, billableUnits?: number): ImmunizationCptCode => ({
  code,
  display: ADMIN_CODE_DISPLAY[code],
  ...(billableUnits && billableUnits > 1 ? { billableUnits } : {}),
});

/** The vaccine's components for 90461: the distinct CDSi antigens its CVX gives (Pentacel 5, MMR 3); 1 when unknown. */
export const cvxComponentCount = (cvx: string | undefined, rules: RulesData = getRulesData()): number => {
  const associations = cvx ? rules.cvxMap.get(cvx.trim())?.associations ?? [] : [];
  return Math.max(1, new Set(associations.map((association) => association.antigen)).size);
};

/** Through 18: before the 19th birthday, the age 90460/90461 are billed to. */
export const isThrough18 = (birthDate: string | undefined, on: DateTime = DateTime.now()): boolean => {
  const born = birthDate ? DateTime.fromISO(birthDate) : undefined;
  return !!born?.isValid && on < born.plus({ years: 19 }).startOf('day');
};

/** A line the page fills the codes of: an order line with a vaccine whose codes are empty or the page's own. */
export const takesSuggestedCodes = (line: ImmunizationFormValues): boolean =>
  !line.outside &&
  !!line.details.medication &&
  (line.cptOrigin === 'suggested' || (!line.cptOrigin && !line.administrationDetails.cptCodes?.length));

export interface CptSuggestionInput {
  /** Through 18 years: counseled vaccines take 90460 / 90461. */
  pediatric: boolean;
  /** Whether the vaccine on the line at this index was counseled on. */
  counseledFor: (index: number) => boolean;
  /** The CPT codes on the visit's other orders (sent earlier, or already sent when a multi-line order is retried). */
  visitCptCodes?: string[];
  rules?: RulesData;
}

/** The suggested admin codes for each line, in page order; undefined for a line the page leaves alone. A counseled
 * vaccine through 18 takes 90460 and 90461 for each component after the first. Any other takes 90471 (injection) or
 * 90473 (nasal, oral) for the visit's first such vaccine, 90472 / 90474 after; a 90471 or 90473 a quick pick or a
 * person put on a line, or one on another order of the visit, is that first one. An RSV monoclonal antibody
 * (nirsevimab, clesrovimab) takes 96380 when counseled, 96381 otherwise, at any age. */
export const suggestCptCodes = (
  lines: ImmunizationFormValues[],
  { pediatric, counseledFor, visitCptCodes = [], rules = getRulesData() }: CptSuggestionInput
): (ImmunizationCptCode[] | undefined)[] => {
  let firstTaken =
    visitCptCodes.some((code) => FIRST_ADMIN_CODES.includes(code.trim())) ||
    lines.some(
      (line) =>
        !line.outside &&
        !takesSuggestedCodes(line) &&
        line.administrationDetails.cptCodes?.some((cpt) => FIRST_ADMIN_CODES.includes(cpt.code.trim()))
    );
  return lines.map((line, index) => {
    if (!takesSuggestedCodes(line)) return undefined;
    // an RSV antibody is not a vaccine for 9046x/9047x and is not the visit's first vaccine
    if (RSV_MONOCLONAL_ANTIBODY_CVX_CODES.has(line.administrationDetails.cvx?.trim() ?? '')) {
      return [adminCode(counseledFor(index) ? '96380' : '96381')];
    }
    if (pediatric && counseledFor(index)) {
      const components = cvxComponentCount(line.administrationDetails.cvx, rules);
      return components > 1 ? [adminCode('90460'), adminCode('90461', components - 1)] : [adminCode('90460')];
    }
    const nasalOrOral = NASAL_OR_ORAL_ROUTES.includes(line.details.route ?? '');
    const code = firstTaken ? (nasalOrOral ? '90474' : '90472') : nasalOrOral ? '90473' : '90471';
    firstTaken = true;
    return [adminCode(code)];
  });
};

const sameCodes = (a: ImmunizationCptCode[] = [], b: ImmunizationCptCode[] = []): boolean =>
  a.length === b.length &&
  a.every((cpt, i) => cpt.code === b[i].code && (cpt.billableUnits ?? 1) === (b[i].billableUnits ?? 1));

/** The lines with their suggested codes applied, and the indexes whose codes changed (to flash). A line that stopped
 * taking suggestions (made external, vaccine cleared) drops the page's codes. Unchanged lines are kept as they are. */
export const applyCptSuggestions = <T extends ImmunizationFormValues>(
  lines: T[],
  input: CptSuggestionInput
): { lines: T[]; changed: number[] } => {
  const suggested = suggestCptCodes(lines, input);
  const changed: number[] = [];
  const next = lines.map((line, index) => {
    const codes = suggested[index];
    if (!codes) {
      if (line.cptOrigin !== 'suggested' || takesSuggestedCodes(line)) return line;
      return { ...line, cptOrigin: undefined, administrationDetails: { ...line.administrationDetails, cptCodes: [] } };
    }
    if (line.cptOrigin === 'suggested' && sameCodes(line.administrationDetails.cptCodes, codes)) return line;
    changed.push(index);
    return {
      ...line,
      cptOrigin: 'suggested' as const,
      administrationDetails: { ...line.administrationDetails, cptCodes: codes },
    };
  });
  return { lines: changed.length || next.some((line, i) => line !== lines[i]) ? next : lines, changed };
};

export type CounselingAnswer = 'yes' | 'no';

/** The Questions box's answers, page state only: one for the visit (none yet = assumed yes), or one per line once
 * "Answers differ by vaccine" is open, falling back to the visit's. */
export interface CounselingAnswers {
  visit?: CounselingAnswer;
  perVaccine: boolean;
  each: Record<number, CounselingAnswer>;
}

export const NO_COUNSELING_ANSWERS: CounselingAnswers = { perVaccine: false, each: {} };

/** The answer for a line (by its key), and whether it is still the assumed yes. */
export const counselingAnswerFor = (
  answers: CounselingAnswers,
  lineKey?: number
): { value: CounselingAnswer; assumed: boolean } => {
  const own = answers.perVaccine && lineKey != null ? answers.each[lineKey] : undefined;
  const value = own ?? answers.visit;
  return value ? { value, assumed: false } : { value: 'yes', assumed: true };
};
