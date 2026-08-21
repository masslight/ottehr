// Prompt-tail inputs that BOTH surfaces need, in one place.
//
// Why shared rather than one copy per zambda: the plan and review surfaces read the same chart and must
// describe it to the model identically. When these lived only in easy-chart-plan, the review handler grew
// its own copies of the note/chart-state builders and simply omitted the patient block — so review always
// rendered "PATIENT STATUS: unknown", dutifully followed the documented fallback, and overwrote a correct
// new-patient E&M code with an established-family one on every new patient. Measured on the harvested
// corpus: the planner had the family right 11/11 when told the status, review then broke it in 7 of 11.
// That is the exact drift this module exists to prevent.

import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { performEffect as listTemplates } from '../list-templates';

export interface VisitContext {
  patientLine: string;
  patientStatus?: 'new' | 'established';
}

/**
 * The authoritative patient block, plus the new/established status that decides the E&M code family.
 * Both are read from the chart; the model is told to take them from here and never from the narrative,
 * because an ambient recording contains cross-talk about other patients.
 */
export async function readVisitContext(
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  encounterId: string,
  zambdaName: string
): Promise<VisitContext | undefined> {
  const resources = (
    await oystehr.fhir.search<Encounter | Patient>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_include', value: 'Encounter:subject' },
      ],
    })
  ).unbundle();

  const patient = resources.find((r): r is Patient => r.resourceType === 'Patient');
  if (!patient?.id) {
    console.log(`[${zambdaName}] no patient on encounter`);
    return undefined;
  }

  // "New" means no professional services in the past 3 years. Counting appointments is the same
  // signal the chart uses for patientHasPreviousVisits; the window makes it match the E&M rule.
  let patientStatus: 'new' | 'established' | undefined;
  try {
    const cutoff = DateTime.now().minus({ years: 3 }).toISODate();
    const priorVisits = await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        { name: 'patient._id', value: patient.id },
        { name: 'date', value: `ge${cutoff}` },
        { name: '_summary', value: 'count' },
      ],
    });
    // The current visit is one of them.
    patientStatus = (priorVisits.total ?? 0) > 1 ? 'established' : 'new';
  } catch (error) {
    // Unknown is a legitimate answer, and the prompt tells the model to default to the established
    // family rather than guess — so a failed lookup must not become a wrong guess.
    console.log(`[${zambdaName}] could not determine patient status`);
    void error;
  }

  return { patientLine: describePatient(patient), patientStatus };
}

export function describePatient(patient: Patient): string {
  const parts: string[] = [];
  if (patient.birthDate) {
    const birth = DateTime.fromISO(patient.birthDate);
    if (birth.isValid) {
      const months = Math.floor(DateTime.now().diff(birth, 'months').months);
      parts.push(months < 24 ? `Age: ${months} month(s)` : `Age: ${Math.floor(months / 12)} years`);
    }
  }
  parts.push(`Sex: ${patient.gender ?? 'unknown'}`);
  return parts.join(', ');
}

export function buildNoteContext(noteContext?: Record<string, string | undefined>): string | undefined {
  if (!noteContext) return undefined;
  const lines = Object.entries(noteContext)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([field, value]) => `${field}: ${value}`);
  return lines.length > 0 ? lines.join('\n\n') : undefined;
}

/**
 * Compose the ALREADY ON THE CHART block from a prose summary plus the checked exam findings.
 *
 * Named for what it does rather than where the data came from: the summary is now built by
 * buildChartStateSummary in utils from a chart READ SERVER-SIDE, and only falls back to a caller-supplied
 * string when there is no encounter to read.
 */
export function describeChart(chartState?: string, examFindings?: string[]): string | undefined {
  const parts: string[] = [];
  if (chartState?.trim()) parts.push(chartState.trim());
  if (examFindings?.length) {
    parts.push(`Exam findings already checked:\n${examFindings.map((f) => `- ${f}`).join('\n')}`);
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/**
 * The practice's template titles, read server-side.
 *
 * The prompt tells the model to match these EXACTLY and never invent one, and with no list the tail renders
 * "AVAILABLE TEMPLATES in this practice: none. Do NOT emit apply-template." Nothing was passing them, so
 * apply-template was switched off for every call — which is why the eval reported zero templates applied on
 * every run and I read that as the model declining to use them.
 *
 * A failure here must not fail the plan: no titles is a degraded prompt, not a broken one.
 */
export async function readTemplateTitles(
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  zambdaName: string
): Promise<string[] | undefined> {
  try {
    const { templates } = await listTemplates({ includeVersionData: false }, oystehr);
    const titles = templates.map((template) => template.title).filter((title): title is string => !!title?.trim());
    return titles.length > 0 ? titles : undefined;
  } catch (error) {
    console.log(`[${zambdaName}] could not list templates; apply-template will be unavailable this call`);
    void error;
    return undefined;
  }
}
