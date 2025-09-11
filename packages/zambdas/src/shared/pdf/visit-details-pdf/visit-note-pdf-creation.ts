import { Appointment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AdditionalBooleanQuestionsFieldsNames,
  ASQ_FIELD,
  ASQKeys,
  asqLabels,
  convertBooleanToString,
  CPTCodeDTO,
  createMedicationString,
  CustomOptionObservationHistoryObtainedFromDTO,
  dispositionCheckboxOptions,
  ExamCardComponent,
  examConfig,
  ExamObservationDTO,
  formatDateTimeToZone,
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  GetChartDataResponse,
  getDefaultNote,
  GetMedicationOrdersResponse,
  getProviderNameWithProfession,
  getQuestionnaireResponseByLinkId,
  getSpentTime,
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  historySourceLabels,
  ImmunizationOrder,
  isDropdownComponent,
  isMultiSelectComponent,
  mapDispositionTypeToLabel,
  mapEncounterStatusHistory,
  mapVitalsToDisplay,
  NOTE_TYPE,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  ObservationBooleanFieldDTO,
  ObservationHistoryObtainedFromDTO,
  ObservationSeenInLastThreeYearsDTO,
  OTTEHR_MODULE,
  recentVisitLabels,
  searchMedicationLocation,
  searchRouteByCode,
  Secrets,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
  Timezone,
} from 'utils';
import { PdfInfo } from '../pdf-utils';
import { PdfExaminationBlockData, VisitNoteData } from '../types';
import { createVisitNotePDF } from '../visit-note-pdf';
import { FullAppointmentResourcePackage } from './types';

type AllChartData = {
  chartData: GetChartDataResponse;
  additionalChartData?: GetChartDataResponse;
  medicationOrders?: GetMedicationOrdersResponse['orders'];
  immunizationOrders?: ImmunizationOrder[];
};

export async function composeAndCreateVisitNotePdf(
  allChartData: AllChartData,
  appointmentPackage: FullAppointmentResourcePackage,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  const isInPersonAppointment = !!appointmentPackage.appointment.meta?.tag?.find(
    (tag) => tag.code === OTTEHR_MODULE.IP
  );

  console.log('Start composing data for pdf');
  const data = composeDataForPdf(allChartData, appointmentPackage, isInPersonAppointment);
  console.log('Start creating pdf');
  return await createVisitNotePDF(data, appointmentPackage.patient!, secrets, token, isInPersonAppointment);
}

function composeDataForPdf(
  allChartData: AllChartData,
  appointmentPackage: FullAppointmentResourcePackage,
  isInPersonAppointment: boolean
): VisitNoteData {
  const { chartData, additionalChartData, medicationOrders, immunizationOrders } = allChartData;

  const { patient, encounter, appointment, location, questionnaireResponse, practitioners, timezone } =
    appointmentPackage;
  if (!patient) throw new Error('No patient found for this encounter');
  // if (!practitioner) throw new Error('No practitioner found for this encounter'); // TODO: fix that

  // --- Patient information ---
  const patientName = getPatientLastFirstName(patient);
  const patientDOB = getPatientDob(patient);
  const personAccompanying = getPersonAccompanying(questionnaireResponse);
  const patientPhone = getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]
    .valueString;

  // --- Visit details ---
  const { dateOfService, signedOnDate } = getStatusRelatedDates(encounter, appointment, timezone);
  const reasonForVisit = appointment?.description;
  let providerName: string;
  let intakePersonName: string | undefined = undefined;
  if (isInPersonAppointment) {
    const admitterId = getAdmitterPractitionerId(encounter);
    const admitterPractitioner = additionalChartData?.practitioners?.find(
      (practitioner) => practitioner.id === admitterId
    );
    intakePersonName = admitterPractitioner && getProviderNameWithProfession(admitterPractitioner);

    const attenderId = getAttendingPractitionerId(encounter);
    const attenderPractitioner = additionalChartData?.practitioners?.find(
      (practitioner) => practitioner.id === attenderId
    );
    providerName = (attenderPractitioner && getProviderNameWithProfession(attenderPractitioner)) ?? '';
  } else {
    providerName = practitioners?.[0] ? getProviderNameWithProfession(practitioners[0]) : '';
  }
  const visitID = appointment.id;
  const visitState = location?.address?.state;
  const address = getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0]
    .valueString;
  const insuranceCompany = appointmentPackage.insurancePlan?.name;
  const subscriberID = getQuestionnaireResponseByLinkId('insurance-member-id', questionnaireResponse)?.answer?.[0]
    .valueString;

  // --- Chief complaint ---
  const chiefComplaint = chartData.chiefComplaint?.text;
  const spentTime = chartData.addToVisitNote?.value ? getSpentTime(encounter.statusHistory) : undefined;

  // --- Review of system ---
  const reviewOfSystems = chartData.ros?.text;

  // --- Medications ---
  const medications = chartData.medications ? mapResourceByNameField(chartData.medications) : [];
  const medicationsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.INTAKE_MEDICATION)
    ?.map((note) => note.text);

  // --- Allergies ---
  const allergies = chartData.allergies
    ? mapResourceByNameField(chartData?.allergies?.filter((allergy) => allergy.current === true))
    : [];
  const allergiesNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.ALLERGY)
    ?.map((note) => note.text);

  // --- Medical conditions ---
  const medicalConditions = mapMedicalConditions(chartData);
  const medicalConditionsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.MEDICAL_CONDITION)
    ?.map((note) => note.text);

  // --- Surgical history ---
  const surgicalHistory = chartData.surgicalHistory ? mapResourceByNameField(chartData.surgicalHistory) : []; // surgical history
  const surgicalHistoryNotes = isInPersonAppointment
    ? additionalChartData?.notes?.filter((note) => note.type === NOTE_TYPE.SURGICAL_HISTORY)?.map((note) => note.text)
    : additionalChartData?.surgicalHistoryNote?.text
    ? [additionalChartData?.surgicalHistoryNote?.text]
    : undefined;

  // --- In-House Medications ---
  const inHouseMedications = medicationOrders
    ?.filter((order) => order.status !== 'cancelled')
    .map((order) => createMedicationString(order));
  const inHouseMedicationsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.MEDICATION)
    ?.map((note) => note.text);

  // --- Immunization orders ---
  const immunizationOrdersToRender = (immunizationOrders ?? [])
    .filter((order) => ['administered', 'administered-partly'].includes(order.status))
    .map(immunizationOrderToString);

  // --- Addition questions ---
  const additionalQuestions = Object.values(AdditionalBooleanQuestionsFieldsNames).reduce(
    (acc, field) => {
      const observation = (
        chartData.observations?.find((obs) => obs.field === field) as ObservationBooleanFieldDTO | undefined
      )?.value;
      acc[field] = convertBooleanToString(observation);
      return acc;
    },
    {} as Record<AdditionalBooleanQuestionsFieldsNames, string>
  );

  const seenInLastThreeYearsObs = chartData?.observations?.find(
    (obs) => obs.field === SEEN_IN_LAST_THREE_YEARS_FIELD
  ) as ObservationSeenInLastThreeYearsDTO | undefined;
  const seenInLastThreeYears = seenInLastThreeYearsObs && recentVisitLabels[seenInLastThreeYearsObs.value];

  const historyObtainedFromObs = chartData?.observations?.find((obs) => obs.field === HISTORY_OBTAINED_FROM_FIELD) as
    | ObservationHistoryObtainedFromDTO
    | undefined;
  const historyObtainedFrom = historyObtainedFromObs && historySourceLabels[historyObtainedFromObs.value];
  const historyObtainedFromOther =
    historyObtainedFromObs && historyObtainedFromObs.value === HistorySourceKeys.NotObtainedOther
      ? (historyObtainedFromObs as CustomOptionObservationHistoryObtainedFromDTO).note
      : undefined;

  const currentASQObs = chartData?.observations?.find((obs) => obs.field === ASQ_FIELD);
  const currentASQ = currentASQObs && asqLabels[currentASQObs.value as ASQKeys];

  const screeningNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.SCREENING)
    ?.map((note) => note.text);

  // --- Hospitalization ---
  const hospitalization =
    additionalChartData?.episodeOfCare && mapResourceByNameField(additionalChartData.episodeOfCare);
  const hospitalizationNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.HOSPITALIZATION)
    ?.map((note) => note.text);

  // --- Vitals ---
  const vitals = additionalChartData?.vitalsObservations
    ? mapVitalsToDisplay(additionalChartData.vitalsObservations, true, timezone)
    : undefined;
  const vitalsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.VITALS)
    ?.map((note) => note.text);

  // --- Intake notes ---
  const intakeNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.INTAKE)
    ?.map((note) => note.text);

  // --- Examination ---
  const examination = parseExamFieldsFromExamObservations(chartData, isInPersonAppointment);

  // --- Assessment ---
  const diagnoses = chartData?.diagnosis || [];
  const primaryDiagnosis = diagnoses.find((item) => item.isPrimary)?.display;
  const otherDiagnoses = diagnoses.filter((item) => !item.isPrimary).map((item) => item.display);

  // --- MDM ---
  // const medicalDecision = additionalChartData?.medicalDecision?.text;
  const medicalDecision = '';

  // --- E&M ---
  const emCode = chartData?.emCode?.display;

  // --- CPT ---
  const cptCodes = chartData?.cptCodes?.map((cpt) => `${cpt.code} ${cpt.display}`);

  // --- Prescriptions ---
  const prescriptions = additionalChartData?.prescribedMedications
    ? mapResourceByNameField(additionalChartData.prescribedMedications)
    : [];

  // --- Patient instructions ---
  const patientInstructions: string[] = [];
  chartData?.instructions?.forEach((item) => {
    if (item.text) patientInstructions.push(item.text);
  });

  // --- General patient education documents ---
  // to be implemented

  // --- Ottehr patient education materials ---
  // to be implemented

  // --- Discharge instructions ---
  const disposition = additionalChartData?.disposition;
  let dispositionHeader = 'Disposition - ';
  let dispositionText = '';
  if (disposition?.type) {
    dispositionHeader += mapDispositionTypeToLabel[disposition.type];
    dispositionText = disposition.note || getDefaultNote(disposition.type);
  }
  const labService = disposition?.labService?.join(', ');
  const virusTest = disposition?.virusTest?.join(', ');
  const followUpIn = typeof disposition?.followUpIn === 'number' ? disposition.followUpIn : undefined;
  const reason = disposition?.reason;

  // --- Subspecialty follow-up ---
  const subSpecialtyFollowUp =
    disposition?.followUp?.map((followUp) => {
      const display = dispositionCheckboxOptions.find((option) => option.name === followUp.type)!.label;
      let note = '';
      if (followUp.type === 'other') note = `: ${followUp.note}`;
      return `${display} ${note}`;
    }) ?? [];

  // --- Work-school excuse ---
  const workSchoolExcuse: string[] = [];
  chartData.schoolWorkNotes?.forEach((ws) => {
    if (ws.type === 'school') workSchoolExcuse.push(`There was a school note generated`);
    else workSchoolExcuse.push('There was a work note generated');
  });

  // --- Procedures ---
  const procedures = chartData?.procedures?.map((procedure) => ({
    procedureType: procedure.procedureType,
    cptCodes: procedure?.cptCodes?.map((cptCode) => cptCode.code + ' ' + cptCode.display),
    diagnoses: procedure?.diagnoses?.map((diagnosis) => diagnosis.code + ' ' + diagnosis.display),
    procedureDateTime:
      procedure.procedureDateTime != null
        ? DateTime.fromISO(procedure.procedureDateTime).toFormat('MM/dd/yyyy, HH:mm a')
        : undefined,
    performerType: procedure.performerType,
    medicationUsed: procedure.medicationUsed,
    bodySite: procedure.bodySite,
    bodySide: procedure.bodySide,
    technique: procedure.technique,
    suppliesUsed: procedure.suppliesUsed,
    procedureDetails: procedure.procedureDetails,
    specimenSent: procedure.specimenSent != null ? (procedure.specimenSent ? 'Yes' : 'No') : undefined,
    complications: procedure.complications,
    patientResponse: procedure.patientResponse,
    postInstructions: procedure.postInstructions,
    timeSpent: procedure.timeSpent,
    documentedBy: procedure.documentedBy,
  }));

  const addendumNote = chartData?.addendumNote?.text;

  return {
    patientName: patientName ?? '',
    patientDOB: patientDOB ?? '',
    personAccompanying: personAccompanying ?? '',
    patientPhone: patientPhone ?? '',
    dateOfService: dateOfService ?? '',
    reasonForVisit: reasonForVisit ?? '',
    provider: providerName ?? '',
    intakePerson: intakePersonName ?? '',
    signedOn: signedOnDate ?? '',
    visitID: visitID ?? '',
    visitState: visitState ?? '',
    insuranceCompany: insuranceCompany,
    insuranceSubscriberId: subscriberID,
    address: address ?? '',
    chiefComplaint: chiefComplaint,
    providerTimeSpan: spentTime,
    reviewOfSystems: reviewOfSystems,
    medications,
    medicationsNotes,
    allergies,
    allergiesNotes,
    medicalConditions,
    medicalConditionsNotes,
    surgicalHistory,
    surgicalHistoryNotes,
    inHouseMedications,
    inHouseMedicationsNotes,
    immunizationOrders: immunizationOrdersToRender,
    additionalQuestions,
    screening: {
      seenInLastThreeYears,
      historyObtainedFrom,
      historyObtainedFromOther,
      currentASQ,
      notes: screeningNotes,
    },
    hospitalization,
    hospitalizationNotes,
    vitals: { notes: vitalsNotes, ...vitals },
    intakeNotes,
    examination: examination.examination,
    assessment: {
      primary: primaryDiagnosis ?? '',
      secondary: otherDiagnoses,
    },
    medicalDecision: medicalDecision,
    cptCodes,
    emCode,
    prescriptions,
    patientInstructions,
    disposition: {
      header: dispositionHeader,
      text: dispositionText ?? '',
      [NOTHING_TO_EAT_OR_DRINK_FIELD]: disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD],
      labService: labService ?? '',
      virusTest: virusTest ?? '',
      followUpIn: followUpIn,
      reason: reason,
    },
    subSpecialtyFollowUp,
    workSchoolExcuse,
    procedures,
    addendumNote,
  };
}

export function getPatientLastFirstName(patient: Patient): string | undefined {
  const name = patient.name;
  const firstName = name?.[0]?.given?.[0];
  const lastName = name?.[0]?.family;
  // const suffix = name?.[0]?.suffix?.[0];
  const isFullName = !!firstName && !!lastName;
  return isFullName ? `${lastName}, ${firstName}` : undefined;
  // const isFullName = !!firstName && !!lastName && !!suffix;
  // return isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;
}

function getPatientDob(patient: Patient): string | undefined {
  return patient?.birthDate && DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
}

function getPersonAccompanying(questionnaireResponse?: QuestionnaireResponse): string | undefined {
  if (!questionnaireResponse) return;

  const personAccompanying = {
    firstName: getQuestionnaireResponseByLinkId('person-accompanying-minor-first-name', questionnaireResponse)
      ?.answer?.[0]?.valueString,
    lastName: getQuestionnaireResponseByLinkId('person-accompanying-minor-last-name', questionnaireResponse)
      ?.answer?.[0]?.valueString,
  };

  if (!personAccompanying.lastName && !personAccompanying.lastName) return;

  return `${personAccompanying.lastName}, ${personAccompanying.lastName}`;
}

function getStatusRelatedDates(
  encounter: Encounter,
  appointment: Appointment,
  timezone: Timezone
): { dateOfService?: string; signedOnDate?: string } {
  const statuses =
    encounter.statusHistory && appointment?.status
      ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
      : undefined;
  const dateOfService = formatDateTimeToZone(statuses?.find((item) => item.status === 'on-video')?.start, timezone);
  const currentTimeISO = DateTime.now().toISO();
  const signedOnDate = formatDateTimeToZone(currentTimeISO, timezone);

  return { dateOfService, signedOnDate };
}

function mapResourceByNameField(data: { name?: string }[] | CPTCodeDTO[]): string[] {
  const result: string[] = [];
  data.forEach((element) => {
    if ('name' in element && element.name) {
      result.push(element.name);
    } else if ('display' in element && element.display) {
      result.push(element.display);
    }
  });
  return result;
}

function mapMedicalConditions(chartData: GetChartDataResponse): string[] {
  const medicalConditions: string[] = [];
  const conditions = chartData?.conditions?.filter((condition) => condition.current === true);
  conditions?.forEach((mc) => {
    if (mc.display && mc.code) medicalConditions.push(`${mc.display} ${mc.code}`);
  });
  return medicalConditions;
}

function parseExamFieldsFromExamObservations(
  chartData: GetChartDataResponse,
  isInPersonAppointment: boolean
): {
  examination: PdfExaminationBlockData['examination'];
} {
  const examObservations: {
    [field: string]: ExamObservationDTO;
  } = {};
  chartData.examObservations?.forEach((exam) => {
    examObservations[exam.field] = exam;
  });

  // Get exam configuration based on whether it's in-person or telemed
  const examConfigComponents = examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;

  // If no exam config or observations, return empty examination
  if (!examConfigComponents || !chartData.examObservations || chartData.examObservations.length === 0) {
    return {
      examination: {},
    };
  }

  const formatElementName = (elementName: string): string => {
    return elementName
      .split('-')
      .map((word) => {
        return word
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
      })
      .join(' | ');
  };

  const extractObservationsFromComponents = (
    components: Record<string, ExamCardComponent>,
    section: 'normal' | 'abnormal'
  ): Array<{ field: string; label: string; abnormal: boolean }> => {
    const items: Array<{ field: string; label: string; abnormal: boolean }> = [];

    Object.entries(components).forEach(([fieldName, component]) => {
      if (component.type === 'text') return;

      switch (component.type) {
        case 'checkbox': {
          const observation = examObservations[fieldName];
          if (observation && typeof observation.value === 'boolean' && observation.value === true) {
            items.push({
              field: fieldName,
              label: component.label,
              abnormal: section === 'abnormal',
            });
          }
          break;
        }

        case 'dropdown': {
          if (isDropdownComponent(component)) {
            Object.entries(component.components).forEach(([optionName, option]) => {
              const observation = examObservations[optionName];
              if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                items.push({
                  field: optionName,
                  label: `${component.label}: ${option.label}`,
                  abnormal: section === 'abnormal',
                });
              }
            });
          }
          break;
        }

        case 'form': {
          Object.entries(component.components).forEach(([elementName]) => {
            const observation = examObservations[elementName];
            if (observation && typeof observation.value === 'boolean' && observation.value === true) {
              const formattedElementName = formatElementName(elementName);
              const note = observation.note ? ` | ${observation.note}` : '';

              items.push({
                field: elementName,
                label: `${component.label}: ${formattedElementName}${note}`,
                abnormal: section === 'abnormal',
              });
            }
          });
          break;
        }

        case 'multi-select': {
          if (isMultiSelectComponent(component)) {
            Object.entries(component.options).forEach(([optionName, option]) => {
              const observation = examObservations[optionName];
              if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                items.push({
                  field: optionName,
                  label: `${component.label}: ${option.label}`,
                  abnormal: section === 'abnormal',
                });
              }
            });
          }
          break;
        }

        case 'column': {
          const nestedItems = extractObservationsFromComponents(component.components, section);
          const itemsWithColumnLabel = nestedItems.map((item) => ({
            ...item,
            label: `${component.label}: ${item.label}`,
          }));
          items.push(...itemsWithColumnLabel);
          break;
        }

        default:
          break;
      }
    });

    return items;
  };

  const examinationData: Record<
    string,
    { items: Array<{ field: string; label: string; abnormal: boolean }>; comment?: string }
  > = {};

  Object.entries(examConfigComponents).forEach(([sectionKey, section]) => {
    const normalItems = extractObservationsFromComponents(section.components.normal, 'normal');
    const abnormalItems = extractObservationsFromComponents(section.components.abnormal, 'abnormal');
    const allItems = [...normalItems, ...abnormalItems];

    let comment: string | undefined;
    Object.keys(section.components.comment).forEach((commentKey) => {
      const observation = examObservations[commentKey];
      if (observation?.note) {
        comment = observation.note;
      }
    });

    examinationData[sectionKey] = {
      items: allItems,
      comment,
    };
  });

  return {
    examination: examinationData,
  };
}

function immunizationOrderToString(order: ImmunizationOrder): string {
  const route = searchRouteByCode(order.details.route)?.display ?? '';
  const location = searchMedicationLocation(order.details.location)?.display ?? '';
  const administratedDateTime = order.administrationDetails?.administeredDateTime
    ? DateTime.fromISO(order.administrationDetails?.administeredDateTime)?.toFormat('MM/dd/yyyy HH:mm a')
    : '';
  return `${order.details.medication.name} - ${order.details.dose} ${order.details.units} / ${route} - ${location}\n${administratedDateTime}`;
}
