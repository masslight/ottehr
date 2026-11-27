import { DateTime } from 'luxon';
import { withEncounterIdParam } from 'src/features/visits/in-person/routing/helpers';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import { getVisitTypeLabelForTypeAndServiceMode } from 'src/shared/utils/formatLabelValue';
import { getFollowUpProgressNotePathSegment } from 'utils/lib/fhir/encounter';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetReading, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { FlowsheetMeasure, FlowsheetUnit } from './registry';

export const TIME_FORMAT = 'h:mm a';
export const DATE_TIME_FORMAT = `${DATE_FORMAT} ${TIME_FORMAT}`;
const REVIEW_AND_SIGN_PATH = 'review-and-sign';

export const formatFixed = (value: number, digits: number): string => {
  const exact = Number(value.toPrecision(12));
  const shifted = Number(`${exact}e${digits}`);
  if (Number.isNaN(shifted)) return exact.toFixed(digits);
  return Number(`${Math.round(shifted)}e-${digits}`).toFixed(digits);
};

export const unitOf = (measure: FlowsheetMeasure, unitSystem: VitalsHeaderUnitSystem): FlowsheetUnit =>
  unitSystem === 'imperial' && measure.imperial ? measure.imperial : measure.metric;

const otherUnitOf = (measure: FlowsheetMeasure, unitSystem: VitalsHeaderUnitSystem): FlowsheetUnit | undefined => {
  if (!measure.imperial) return undefined;
  return unitSystem === 'imperial' ? measure.metric : measure.imperial;
};

export const inUnit = (metricValue: number, unit: FlowsheetUnit): number =>
  unit.fromMetric ? unit.fromMetric(metricValue) : metricValue;

export const measureLabel = (measure: FlowsheetMeasure, unitSystem: VitalsHeaderUnitSystem): string =>
  `${measure.title} (${unitOf(measure, unitSystem).label})`;

const formatValues = (metricValues: number[], unit: FlowsheetUnit): string =>
  metricValues.map((value) => formatFixed(inUnit(value, unit), unit.digits)).join('/');

export const describeReading = (
  measure: FlowsheetMeasure,
  reading: FlowsheetReading,
  unitSystem: VitalsHeaderUnitSystem,
  separator = ' '
): string => {
  const withUnit = (unit: FlowsheetUnit): string =>
    `${formatValues(reading.values, unit)} ${unit.hoverLabel ?? unit.label}`;
  const other = otherUnitOf(measure, unitSystem);
  const value = withUnit(unitOf(measure, unitSystem));
  return [
    DateTime.fromISO(reading.time).toFormat(DATE_TIME_FORMAT),
    other ? `${value} ≈ ${withUnit(other)}` : value,
    reading.flag,
  ]
    .filter(Boolean)
    .join(separator);
};

export interface FlowsheetCell {
  text: string;
  flag?: VitalAlertCriticality;
  moreCount: number;
  hoverLines: string[];
}

export const cellOf = (
  measure: FlowsheetMeasure,
  visit: FlowsheetVisit,
  unitSystem: VitalsHeaderUnitSystem
): FlowsheetCell | undefined => {
  const readings = visit.values[measure.key] ?? [];
  const latest = readings.at(-1);
  if (!latest) return undefined;
  return {
    text: formatValues(latest.values, unitOf(measure, unitSystem)),
    flag: latest.flag,
    moreCount: readings.length - 1,
    hoverLines: readings.map((reading) => describeReading(measure, reading, unitSystem)),
  };
};

export interface VisitColumn extends FlowsheetVisit {
  label: string;
  url?: string;
  isCurrent: boolean;
}

const headerUrl = (visit: FlowsheetVisit): string | undefined => {
  const id = visit.isFollowUp ? visit.originalAppointmentId : visit.appointmentId;
  if (!id) return undefined;
  const note = visit.isFollowUp ? getFollowUpProgressNotePathSegment(visit.followupSubtype) : REVIEW_AND_SIGN_PATH;
  return withEncounterIdParam(`/in-person/${id}/${note}`, visit.encounterId);
};

export const toColumns = (visits: FlowsheetVisit[], currentEncounterId?: string): VisitColumn[] => {
  const days = visits.map((visit) => DateTime.fromISO(visit.start).toFormat(DATE_FORMAT));
  return visits.map((visit, index) => {
    const sharesDay = days.filter((day) => day === days[index]).length > 1;
    const date = sharesDay ? DateTime.fromISO(visit.start).toFormat(DATE_TIME_FORMAT) : days[index];
    return {
      ...visit,
      label: visit.isFollowUp ? `${date} (follow-up)` : date,
      url: headerUrl(visit),
      isCurrent: !!currentEncounterId && visit.encounterId === currentEncounterId,
    };
  });
};

export const visitTypeLabel = (
  visit: FlowsheetVisit,
  resolveServiceCategoryAbbreviation: (codeOrName?: string) => string | undefined
): string => {
  const type = visit.isFollowUp
    ? visit.followUpType
    : visit.appointmentType &&
      getVisitTypeLabelForTypeAndServiceMode({ type: visit.appointmentType, serviceMode: visit.serviceMode });
  if (!type) return '-';
  const category = resolveServiceCategoryAbbreviation(visit.serviceCategory);
  return category ? `${type} / ${category}` : type;
};
