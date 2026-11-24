// Chart reads and prompt-tail inputs for the planner: the visit as the model is told about it.

import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PatientStatus } from 'utils/lib/easy-chart/api';
import { wholeChartFromVisitNote } from 'utils/lib/easy-chart/visit-note-chart';
import { getEmCodes } from 'utils/lib/helpers/em-codes';
import { isNewPatient } from 'utils/lib/helpers/screening-questions/new-patient.helper';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { TemplateDiagnosis } from 'utils/lib/types/data/list-template.types';
import { buildVisitNote } from '../../shared/chart-sections/visit-note';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { listTemplates } from '../shared/list-templates';

type ClinicalOystehrClient = ReturnType<typeof createClinicalOystehrClient>;

export interface VisitContext {
  patientLine: string;
  appointment?: Appointment;
}

/**
 * Age and sex, plus the visit's appointment for the new/established status. Read from the chart:
 * an ambient recording can contain cross-talk about other patients.
 */
export async function readVisitContext(
  oystehr: ClinicalOystehrClient,
  encounterId: string,
  zambdaName: string
): Promise<VisitContext | undefined> {
  const resources = (
    await oystehr.fhir.search<Encounter | Patient | Appointment>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_include', value: 'Encounter:subject' },
        { name: '_include', value: 'Encounter:appointment' },
      ],
    })
  ).unbundle();

  const patient = resources.find((r): r is Patient => r.resourceType === 'Patient');
  if (!patient?.id) {
    console.log(`[${zambdaName}] no patient on encounter`);
    return undefined;
  }

  const appointment = resources.find((r): r is Appointment => r.resourceType === 'Appointment');
  return { patientLine: describePatient(patient), appointment };
}

export function readPatientStatus(chart: GetChartDataResponse, appointment: Appointment | undefined): PatientStatus {
  return isNewPatient(chart.patientHasPreviousVisits ?? false, [{ observations: chart.observations, appointment }])
    ? 'new'
    : 'established';
}

/** Age and sex only; nothing else about the patient is needed to chart or code. */
function describePatient(patient: Patient): string {
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

/** The whole chart, from the same read get-visit-note and the visit-note PDF make. */
export async function readChart(
  oystehr: ClinicalOystehrClient,
  m2mToken: string,
  encounterId: string
): Promise<GetChartDataResponse> {
  return wholeChartFromVisitNote(await buildVisitNote({ oystehr, m2mToken }, encounterId));
}

export function buildNoteContext(noteContext?: Record<string, string | undefined>): string | undefined {
  if (!noteContext) return undefined;
  const lines = Object.entries(noteContext)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([field, value]) => `${field}: ${value}`);
  return lines.length > 0 ? lines.join('\n\n') : undefined;
}

/** The ALREADY ON THE CHART block: the chart-state summary plus the checked exam findings. */
export function describeChart(chartState?: string, examFindings?: string[]): string | undefined {
  const parts: string[] = [];
  if (chartState?.trim()) parts.push(chartState.trim());
  if (examFindings?.length) {
    parts.push(`Exam findings already checked:\n${examFindings.map((f) => `- ${f}`).join('\n')}`);
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/** The E&M codes the practice has enabled. Undefined when they could not be read, so no code is refused for it. */
export async function readEmCodes(oystehr: ClinicalOystehrClient, zambdaName: string): Promise<string[] | undefined> {
  try {
    return (await getEmCodes(oystehr)).map((option) => option.code);
  } catch {
    console.log(`[${zambdaName}] could not read the practice's E&M codes; set-em-code is not checked against them`);
    return undefined;
  }
}

export interface PracticeTemplate {
  id: string;
  title: string;
  /** Primary first. */
  diagnoses: TemplateDiagnosis[];
}

/** The practice's templates. Undefined when the list is empty or could not be read: a degraded prompt, not a failure. */
export async function readTemplates(
  oystehr: ClinicalOystehrClient,
  zambdaName: string
): Promise<PracticeTemplate[] | undefined> {
  try {
    const { templates } = await listTemplates({ includeVersionData: false, includeDiagnoses: true }, oystehr);
    const usable = templates
      .filter(
        (template): template is typeof template & { id: string; title: string } =>
          !!template.id && !!template.title?.trim()
      )
      .map((template) => ({ id: template.id, title: template.title, diagnoses: template.diagnoses ?? [] }));
    return usable.length > 0 ? usable : undefined;
  } catch {
    console.log(`[${zambdaName}] could not list templates; apply-template will be unavailable this call`);
    return undefined;
  }
}
