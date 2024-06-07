import { DateTime } from 'luxon';
import { WorkSchoolNoteExcuseDocDTO } from 'ehr-utils';
import { ArrayElement } from '../../shared/types';

export const mapExcuseTypeToFields = {
  workTemplate: ['parentName', 'headerNote', 'workFields', 'footerNote'],
  workFree: ['parentName', 'headerNote'],
  schoolTemplate: ['headerNote', 'schoolFields', 'footerNote'],
  schoolFree: ['headerNote'],
};

export const workExcuseFields = [
  'wereWithThePatientAtTheTimeOfTheVisit',
  'areNeededAtHomeToCareForChildDuringThisIllness',
  'excusedFromWorkFromTo',
  'excusedFromWorkOn',
] as const;

export const schoolExcuseFields = [
  'excusedFromSchoolFromTo',
  'excusedFromSchoolOn',
  'excusedFromSchoolUntilFeverFreeFor24Hours',
  'excusedFromSchoolUntilOnAntibioticsFor24Hours',
  'ableToReturnToSchoolWithoutRestriction',
  'ableToReturnToGymActivitiesWithoutRestriction',
  'ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge',
  'excusedFromGymActivitiesFromTo',
  'ableToReturnToSchoolWithTheFollowingRestrictions',
  'dominantHandIsInjuredPleaseAllowAccommodations',
  'needsExtraTimeBetweenClassesAssistantOrBookBuddy',
  'otherRestrictions',
  'allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary',
  'allowedUseOfElevatorAsNecessary',
  'unableToParticipateInGymActivitiesUntilClearedByAPhysician',
  'excusedFromWorkFromTo',
  'excusedFromWorkOn',
  'ableToReturnToWorkWithTheFollowingRestrictions',
  'other',
] as const;

export const dateExcuseFields = [
  'excusedFromWorkFromDate',
  'excusedFromWorkToDate',
  'excusedFromWorkOnDate',
  'excusedFromSchoolFromDate',
  'excusedFromSchoolToDate',
  'excusedFromSchoolOnDate',
  'excusedFromGymActivitiesFromDate',
  'excusedFromGymActivitiesToDate',
] as const;

export const noteExcuseFields = [
  'parentName',
  'headerNote',
  'footerNote',
  'otherRestrictionsNote',
  'ableToReturnToWorkWithTheFollowingRestrictionsNote',
  'otherNote',
] as const;

export type WorkExcuseFields = ArrayElement<typeof workExcuseFields>;
export type SchoolExcuseFields = ArrayElement<typeof schoolExcuseFields>;
export type DateExcuseFields = ArrayElement<typeof dateExcuseFields>;
export type NoteExcuseFields = ArrayElement<typeof noteExcuseFields>;

export type ExcuseFormValues = { [key in WorkExcuseFields]: boolean } & { [key in SchoolExcuseFields]: boolean } & {
  [key in DateExcuseFields]: DateTime | null;
} & {
  [key in NoteExcuseFields]: string;
};

export const mapExcuseFieldsToLabels = {
  wereWithThePatientAtTheTimeOfTheVisit: 'were with the patient at the time of the visit',
  areNeededAtHomeToCareForChildDuringThisIllness: 'are needed at home to care for child during this illness',
  excusedFromWorkFromTo: 'excused from work from - to',
  excusedFromWorkOn: 'excused from work on',
  excusedFromSchoolFromTo: 'excused from school from - to',
  excusedFromSchoolOn: 'excused from school on',
  excusedFromSchoolUntilFeverFreeFor24Hours: 'excused from school until fever free for 24 hours',
  excusedFromSchoolUntilOnAntibioticsFor24Hours: 'excused from school until on antibiotics for 24 hours',
  ableToReturnToSchoolWithoutRestriction: 'able to return to school without restriction',
  ableToReturnToGymActivitiesWithoutRestriction: 'able to return to gym/activities without restriction',
  ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge:
    'able to return to school when there no longer is any eye discharge',
  excusedFromGymActivitiesFromTo: 'excused from gym/activities from - to',
  ableToReturnToSchoolWithTheFollowingRestrictions: 'able to return to school with the following restrictions:',
  dominantHandIsInjuredPleaseAllowAccommodations: 'dominant hand is injured, please allow accommodations',
  needsExtraTimeBetweenClassesAssistantOrBookBuddy: 'needs extra time between classes, assistant or book buddy',
  otherRestrictions: 'other',
  allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary:
    'allowed use of crutches, ace wrap, splint and elevator as necessary',
  allowedUseOfElevatorAsNecessary: 'allowed use of elevator as necessary',
  unableToParticipateInGymActivitiesUntilClearedByAPhysician:
    'unable to participate in gym activities until cleared by a physician',
  ableToReturnToWorkWithTheFollowingRestrictions: 'able to return to work with the following restrictions',
  other: 'other',
} as const;

const mapCompositeExcuseFieldsToLabels: {
  [P in SchoolExcuseFields | WorkExcuseFields]?: (values: ExcuseFormValues) => string;
} = {
  excusedFromWorkFromTo: (values: ExcuseFormValues) =>
    `excuse from work from ${values.excusedFromWorkFromDate!.toFormat(
      'MM/dd/yyyy'
    )} to ${values.excusedFromWorkToDate!.toFormat('MM/dd/yyyy')}`,
  excusedFromWorkOn: (values: ExcuseFormValues) =>
    `excuse from work on ${values.excusedFromWorkOnDate!.toFormat('MM/dd/yyyy')}`,
  excusedFromSchoolFromTo: (values: ExcuseFormValues) =>
    `excuse from school from ${values.excusedFromSchoolFromDate!.toFormat(
      'MM/dd/yyyy'
    )} to ${values.excusedFromSchoolToDate!.toFormat('MM/dd/yyyy')}`,
  excusedFromSchoolOn: (values: ExcuseFormValues) =>
    `excuse from school on ${values.excusedFromSchoolOnDate!.toFormat('MM/dd/yyyy')}`,
  excusedFromGymActivitiesFromTo: (values: ExcuseFormValues) =>
    `excuse from gym/activities from ${values.excusedFromGymActivitiesFromDate!.toFormat(
      'MM/dd/yyyy'
    )} to ${values.excusedFromGymActivitiesToDate!.toFormat('MM/dd/yyyy')}`,
  otherRestrictions: (values: ExcuseFormValues) => values.otherRestrictionsNote,
  other: (values: ExcuseFormValues) => values.otherNote,
};

export const getDefaultExcuseFormValues = (params: {
  patientName?: string;
  parentName?: string;
  isSchool: boolean;
  isTemplate: boolean;
  providerName?: string;
  suffix?: string;
  phoneNumber?: string;
}): ExcuseFormValues => {
  const defaultFormValues = {
    ...noteExcuseFields.reduce((prev, curr) => ({ ...prev, [curr]: '' }), {}),
    ...dateExcuseFields.reduce((prev, curr) => ({ ...prev, [curr]: null }), {}),
    ...schoolExcuseFields.reduce((prev, curr) => ({ ...prev, [curr]: false }), {}),
    ...workExcuseFields.reduce((prev, curr) => ({ ...prev, [curr]: false }), {}),
    excusedFromWorkFromDate: DateTime.now(),
    excusedFromWorkOnDate: DateTime.now(),
    excusedFromSchoolFromDate: DateTime.now(),
    excusedFromSchoolOnDate: DateTime.now(),
    excusedFromGymActivitiesFromDate: DateTime.now(),
  } as ExcuseFormValues;

  const currentDate = DateTime.now().toFormat('MM/dd/yyyy');

  if (!params.isSchool && params.parentName) {
    defaultFormValues.parentName = params.parentName;
  }

  const headerNoteName = params.isSchool
    ? params.patientName || '{Patient name}'
    : `${params.patientName || '{Patient name}'}, the child of ${params.parentName || '{Parent/Guardian name}'},`;

  defaultFormValues.headerNote = `To whom it may concern:\n${headerNoteName} was treated by Ottehr on ${currentDate}. They are:`;

  if (params.isTemplate) {
    if (params.phoneNumber) {
      defaultFormValues.footerNote = `For any questions, please do not hesitate to call ${params.phoneNumber}.\n`;
    }
    defaultFormValues.footerNote += `Sincerely,\n${params.providerName || '{Provider name}'}, ${
      params.suffix || 'Medical Doctor'
    }`;
  }

  return defaultFormValues;
};

export const mapValuesToExcuse = (
  values: ExcuseFormValues,
  params: {
    type: keyof typeof mapExcuseTypeToFields;
    isSchool: boolean;
    isTemplate: boolean;
    patientName?: string;
    providerName?: string;
    suffix?: string;
  }
): WorkSchoolNoteExcuseDocDTO => {
  const excuse: WorkSchoolNoteExcuseDocDTO = {
    type: params.isSchool ? 'school' : 'work',
    documentHeader: params.isSchool
      ? `School note for ${params.patientName || 'Unknown'}`
      : `Work note for ${values.parentName}`,
    parentGuardianName: values.parentName || 'Unknown',
    headerNote: values.headerNote,
    footerNote: values.footerNote,
    providerDetails: {
      credentials: params.suffix || 'Medical Doctor',
      name: params.providerName || 'Unknown',
    },
  };

  if (params.isTemplate) {
    excuse.bulletItems = [];

    const subFields: Record<string, string[]> = {
      ableToReturnToSchoolWithTheFollowingRestrictions: [
        'dominantHandIsInjuredPleaseAllowAccommodations',
        'needsExtraTimeBetweenClassesAssistantOrBookBuddy',
        'otherRestrictions',
      ],
    };
    let currentSubFields: string[] | undefined;

    const excuseFields = params.isSchool ? schoolExcuseFields : workExcuseFields;

    excuseFields.forEach((field) => {
      if (!values[field]) {
        return;
      }

      const func = mapCompositeExcuseFieldsToLabels[field];
      const str = func ? func(values) : mapExcuseFieldsToLabels[field];

      if (subFields[field]) {
        currentSubFields = subFields[field];
      }

      if (currentSubFields?.includes(field)) {
        const currentItem = excuse.bulletItems!.at(-1)!;
        if (!currentItem.subItems) {
          currentItem.subItems = [];
        }
        currentItem.subItems.push({
          text: str,
        });
      } else {
        excuse.bulletItems!.push({
          text: str,
        });
      }
    });

    if (excuse.bulletItems!.length === 0) {
      delete excuse.bulletItems;
    }
  }

  return excuse;
};
