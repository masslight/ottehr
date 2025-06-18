import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Bundle, Coding, Flag, Patient, Resource } from 'fhir/r4b';
import { diff, IChange } from 'json-diff-ts';
import { DateTime } from 'luxon';
import { FhirAppointmentType, getFullName, getCriticalUpdateTagOp, CRITICAL_CHANGE_SYSTEM } from 'utils';
import { HOP_QUEUE_URI } from '../constants';
import { appointmentTypeLabels } from '../types/types';
import { formatDateUsingSlashes } from './formatDateTime';

const CREATED_BY_SYSTEM = 'created-by'; // exists in intake as well

export enum ActivityName {
  apptCreation = 'Visit Creation',
  nameChange = 'Name Update',
  dobChange = 'Date of Birth Update',
  movedToNext = 'Moved to next in queue',
  paperworkStarted = 'Paperwork started',
}
export interface ActivityLogData {
  activityDateTimeISO: string | undefined;
  activityDateTime: string;
  activityName: ActivityName;
  activityNameSupplement?: string;
  activityBy: string;
  moreDetails?: {
    valueBefore: string;
    valueAfter: string;
  };
}

export interface NoteHistory {
  note: string;
  noteAddedByAndWhen: string;
}

export const cleanUpStaffHistoryTag = (resource: Resource, field: string): Operation | undefined => {
  // going forward we will be using the history of the patient resource so this isn't needed
  // check if there is a tag to clean up
  const staffHistoryTagIdx = resource.meta?.tag?.findIndex((tag) => tag.system === `staff-update-history-${field}`);
  if (staffHistoryTagIdx !== undefined && staffHistoryTagIdx >= 0) {
    return {
      op: 'remove',
      path: `/meta/tag/${staffHistoryTagIdx}`,
    };
  } else {
    return;
  }
};

export const getAppointmentAndPatientHistory = async (
  appointment: Appointment | undefined,
  oystehr: Oystehr | undefined
): Promise<{ patientHistory: Patient[]; appointmentHistory: Appointment[] } | undefined> => {
  if (!appointment || !oystehr) return;
  const appointmentId = appointment?.id;
  const patientId = appointment?.participant
    .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.replace('Patient/', '');
  const bundle = await oystehr.fhir.batch({
    requests: [
      {
        method: 'GET',
        url: `/Appointment/${appointmentId}/_history`,
      },
      {
        method: 'GET',
        url: `/Patient/${patientId}/_history`,
      },
    ],
  });

  const patientHistory: Patient[] = [];
  const appointmentHistory: Appointment[] = [];
  if (bundle.entry) {
    for (const entry of bundle.entry) {
      if (entry.response?.outcome?.id === 'ok' && entry.resource && entry.resource.resourceType === 'Bundle') {
        const innerBundle = entry.resource as Bundle;
        const innerEntries = innerBundle.entry;
        if (innerEntries) {
          for (const item of innerEntries) {
            const resource = item.resource;
            if (resource) {
              if (resource?.resourceType === 'Appointment') {
                const fhirAppointment = resource as Appointment;
                appointmentHistory.push(fhirAppointment);
              }
              if (resource?.resourceType === 'Patient') {
                const fhirPatient = resource as Patient;
                patientHistory.push(fhirPatient);
              }
            }
          }
        }
      }
    }
  }

  return { patientHistory, appointmentHistory };
};

export const formatActivityLogs = (
  appointment: Appointment,
  appointmentHistory: Appointment[],
  patientHistory: Patient[],
  paperworkStartedFlag: Flag | undefined,
  timezone: string
): ActivityLogData[] => {
  const logs: ActivityLogData[] = [];

  // check each patient history object against the previous for diffs
  for (let i = 0; i < patientHistory.length - 1; i++) {
    const curPatientHistory = patientHistory[i];
    const previousPatientHistory = patientHistory[i + 1];
    let activityBy: string | undefined;

    // console.log(`checking ${curPatientHistory?.meta?.versionId} against ${previousPatientHistory?.meta?.versionId}`);
    const diffs = diff(previousPatientHistory, curPatientHistory, { embeddedObjKeys: { 'meta.tag': 'system' } });

    // check diffs for critical updates (ie updates that need to be surfaced in change logs)
    diffs.forEach((diff) => {
      // make sure that a critical update by tag was added with this change
      // the display may be the same but the version should always be different if it was "new" for the change
      // this ensures that we aren't assuming anything about who made the update
      if (diff.key === 'meta') {
        const criticalUpdateMadeBy = getCriticalUpdateMadeBy(diff, curPatientHistory);
        if (criticalUpdateMadeBy) activityBy = criticalUpdateMadeBy;
      }
      if (diff.key === 'name') {
        const nameChangeActivityLog: ActivityLogData = {
          activityName: ActivityName.nameChange,
          activityDateTimeISO: curPatientHistory.meta?.lastUpdated,
          activityDateTime: formatActivityDateTime(curPatientHistory.meta?.lastUpdated || '', timezone),
          activityBy: activityBy ? activityBy : 'n/a',
          moreDetails: {
            valueBefore: getFullName(previousPatientHistory),
            valueAfter: getFullName(curPatientHistory),
          },
        };
        logs.push(nameChangeActivityLog);
      }
      if (diff.key === 'birthDate') {
        const dobChangeActivityLog: ActivityLogData = {
          activityName: ActivityName.dobChange,
          activityDateTimeISO: curPatientHistory.meta?.lastUpdated,
          activityDateTime: formatActivityDateTime(curPatientHistory.meta?.lastUpdated || '', timezone),
          activityBy: activityBy ? activityBy : 'n/a',
          moreDetails: {
            valueBefore: formatDateUsingSlashes(previousPatientHistory.birthDate) || '',
            valueAfter: formatDateUsingSlashes(curPatientHistory.birthDate) || '',
          },
        };
        logs.push(dobChangeActivityLog);
      }
    });
  }

  // check each appointment history object against the previous for diffs
  for (let i = 0; i < appointmentHistory.length - 1; i++) {
    const curApptHistory = appointmentHistory[i];
    const previousApptHistory = appointmentHistory[i + 1];
    let activityBy: string | undefined;

    const diffs = diff(previousApptHistory, curApptHistory, { embeddedObjKeys: { 'meta.tag': 'system' } });

    // check diffs for critical updates (ie updates that need to be surfaced in change logs)
    diffs.forEach((diff) => {
      // make sure that a critical update by tag was added with this change
      // the display may be the same but the version should always be different if it was "new" for the change
      // this ensures that we aren't assuming anything about who made the update
      if (diff.key === 'meta') {
        const criticalUpdateMadeBy = getCriticalUpdateMadeBy(diff, curApptHistory);
        if (criticalUpdateMadeBy) activityBy = criticalUpdateMadeBy;
        const tagChanges = diff.changes?.find((change) => change.key === 'tag')?.changes;
        if (tagChanges) {
          const movedToNext = tagChanges.find((change) => change.key === HOP_QUEUE_URI);
          if (movedToNext) {
            const movedToNextLog: ActivityLogData = {
              activityName: ActivityName.movedToNext,
              activityDateTimeISO: curApptHistory.meta?.lastUpdated,
              activityDateTime: formatActivityDateTime(curApptHistory.meta?.lastUpdated || '', timezone),
              activityBy: activityBy ? activityBy : 'n/a',
            };
            logs.push(movedToNextLog);
          }
        }
      }
    });
  }

  if (paperworkStartedFlag) {
    const paperworkStartedActivityLog = formatPaperworkStartedLog(paperworkStartedFlag, timezone);
    logs.push(paperworkStartedActivityLog);
  }
  const appointmentVisitType = appointment.appointmentType?.text;
  logs.push({
    activityName: ActivityName.apptCreation,
    activityNameSupplement: appointmentVisitType
      ? appointmentTypeLabels[appointmentVisitType as FhirAppointmentType]
      : '',
    activityDateTimeISO: appointment?.created,
    activityDateTime: formatActivityDateTime(appointment?.created || '', timezone),
    activityBy: appointment.meta?.tag?.find((tag) => tag.system === CREATED_BY_SYSTEM)?.display || 'n/a',
  });

  return sortLogs(logs);
};

export const formatPaperworkStartedLog = (paperworkStartedFlag: Flag, timezone: string): ActivityLogData => {
  const createdTag = paperworkStartedFlag.meta?.tag?.find((tag) => tag?.system === 'created-date-time');
  const activityDateTimeISO = createdTag?.version;
  const activityDateTime = formatActivityDateTime(activityDateTimeISO || '', timezone);
  const activityBy = createdTag?.display || 'n/a';
  const paperworkStartedActivityLog: ActivityLogData = {
    activityName: ActivityName.paperworkStarted,
    activityDateTimeISO,
    activityDateTime,
    activityBy,
  };
  return paperworkStartedActivityLog;
};

export const sortLogs = (logs: ActivityLogData[]): ActivityLogData[] => {
  return logs.sort((a, b) => {
    const dateA = DateTime.fromISO(a.activityDateTimeISO || '');
    const dateB = DateTime.fromISO(b.activityDateTimeISO || '');
    return dateB.diff(dateA, 'milliseconds').milliseconds;
  });
};

const getCriticalUpdateMadeBy = (diff: IChange, resource: Resource): string | undefined => {
  let activityBy: string | undefined;
  const tagChange = diff.changes?.find((d) => d.key === 'tag');
  if (tagChange?.type === 'UPDATE') {
    const criticalUpdateBy = tagChange.changes?.find((change) => change.key === CRITICAL_CHANGE_SYSTEM);
    if (criticalUpdateBy?.type === 'UPDATE') {
      const criticalUpdateByVersion = criticalUpdateBy.changes?.find((change) => change.key === 'version')?.value;
      if (criticalUpdateByVersion)
        activityBy = resource.meta?.tag?.find((tag) => tag.system === CRITICAL_CHANGE_SYSTEM)?.display;
    }
    if (criticalUpdateBy?.type === 'ADD') {
      const criticalUpdateByCoding = criticalUpdateBy.value as Coding;
      activityBy = criticalUpdateByCoding?.display;
    }
  }
  if (tagChange?.type === 'ADD') {
    const criticalUpdateBy = tagChange.value?.find((value: Coding) => value.system === CRITICAL_CHANGE_SYSTEM);
    if (criticalUpdateBy) {
      const criticalUpdateByCoding = criticalUpdateBy as Coding;
      activityBy = criticalUpdateByCoding?.display;
    }
  }
  return activityBy;
};

export const formatActivityDateTime = (dateTime: string, timezone: string): string => {
  const date = DateTime.fromISO(dateTime).setZone(timezone);
  const dateFormatted = formatDateUsingSlashes(date.toISO() || '');
  const timeFormatted = date.toLocaleString(DateTime.TIME_SIMPLE);
  const timezoneShort = date.offsetNameShort;
  return `${dateFormatted} ${timeFormatted} ${timezoneShort ?? ''}`;
};

export const formatNotesHistory = (timezone: string, appointmentHistory: Appointment[]): NoteHistory[] => {
  const notes: NoteHistory[] = [];
  for (let i = 0; i < appointmentHistory.length - 1; i++) {
    const curApptHistory = appointmentHistory[i];
    const previousApptHistory = appointmentHistory[i + 1];
    let activityBy: string | undefined;

    const diffs = diff(previousApptHistory, curApptHistory, { embeddedObjKeys: { 'meta.tag': 'system' } });
    // check diffs for critical updates (ie updates that need to be surfaced in change logs)
    diffs.forEach((diff) => {
      // make sure that a critical update by tag was added with this change
      // the display may be the same but the version should always be different if it was "new" for the change
      // this ensures that we aren't assuming anything about who made the update
      if (diff.key === 'meta') {
        const criticalUpdateMadeBy = getCriticalUpdateMadeBy(diff, curApptHistory);
        if (criticalUpdateMadeBy) activityBy = criticalUpdateMadeBy;
      }
      if (diff.key === 'comment') {
        let noteVal = diff.value;
        if (diff.type === 'REMOVE') {
          noteVal = '';
        }
        const dtAdded = formatActivityDateTime(curApptHistory.meta?.lastUpdated || '', timezone);
        const note: NoteHistory = {
          note: noteVal,
          noteAddedByAndWhen: `${dtAdded} By ${activityBy}`,
        };
        notes.push(note);
      }
    });
  }
  return notes;
};

export { getCriticalUpdateTagOp, CRITICAL_CHANGE_SYSTEM };
