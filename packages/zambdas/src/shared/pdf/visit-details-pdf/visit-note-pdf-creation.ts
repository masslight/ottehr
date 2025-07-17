import { Appointment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AdditionalBooleanQuestionsFieldsNames,
  ASQ_FIELD,
  ASQKeys,
  asqLabels,
  convertBooleanToString,
  convertTemperature,
  CPTCodeDTO,
  CustomOptionObservationHistoryObtainedFromDTO,
  dispositionCheckboxOptions,
  ExamCardsNames,
  ExamFieldsNames,
  ExamObservationDTO,
  ExamObservationFieldItem,
  examObservationFieldsDetailsArray,
  formatDateTimeToZone,
  GetChartDataResponse,
  getDefaultNote,
  getProviderNameWithProfession,
  getQuestionnaireResponseByLinkId,
  getSpentTime,
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  historySourceLabels,
  IN_PERSON_EXAM_CARDS,
  InPersonExamCardsNames,
  InPersonExamFieldsNames,
  inPersonExamObservationFieldsDetailsArray,
  InPersonExamTabProviderCardNames,
  mapDispositionTypeToLabel,
  mapEncounterStatusHistory,
  mapVitalsToDisplay,
  NOTE_TYPE,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  ObservationBooleanFieldDTO,
  ObservationHistoryObtainedFromDTO,
  ObservationSeenInLastThreeYearsDTO,
  OTTEHR_MODULE,
  parseMusculoskeletalFieldToName,
  rashesOptions,
  recentVisitLabels,
  Secrets,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
  Timezone,
} from 'utils';
import { PdfInfo } from '../pdf-utils';
import { InPersonExamBlockData, TelemedExamBlockData, VisitNoteData } from '../types';
import { createVisitNotePDF } from '../visit-note-pdf';
import { FullAppointmentResourcePackage } from './types';

type AllChartData = { chartData: GetChartDataResponse; additionalChartData?: GetChartDataResponse };

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
  const { chartData, additionalChartData } = allChartData;

  const { patient, encounter, appointment, location, questionnaireResponse, practitioner, timezone } =
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
  const provider = practitioner && getProviderNameWithProfession(practitioner);
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
  const surgicalHistoryNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.SURGICAL_HISTORY)
    ?.map((note) => note.text);

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
    ? mapVitalsToDisplay(additionalChartData.vitalsObservations, timezone)
    : undefined;
  const vitalsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.VITALS)
    ?.map((note) => note.text);

  // --- Intake notes ---
  const intakeNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.INTAKE)
    ?.map((note) => note.text);

  // --- Examination ---
  const examination = isInPersonAppointment
    ? parseInPersonExamFieldsFromExamObservations(chartData)
    : parseExamFieldsFromExamObservations(chartData, questionnaireResponse);

  // --- Assessment ---
  const diagnoses = chartData?.diagnosis || [];
  const primaryDiagnosis = diagnoses.find((item) => item.isPrimary)?.display;
  const otherDiagnoses = diagnoses.filter((item) => !item.isPrimary).map((item) => item.display);

  // --- MDM ---
  // const medicalDecision = chartData?.medicalDecision?.text;
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
    provider: provider ?? '',
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

function getPatientLastFirstName(patient: Patient): string | undefined {
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
  questionnaireResponse: QuestionnaireResponse | undefined
): { examination: TelemedExamBlockData } {
  const examObservations: {
    [field in ExamFieldsNames | ExamCardsNames | InPersonExamCardsNames | InPersonExamFieldsNames]?: ExamObservationDTO;
  } = {};
  chartData.examObservations?.forEach((exam) => {
    examObservations[exam.field] = exam;
  });

  const generalItems: ExamObservationFieldItem[] = [];
  const headItems: ExamObservationFieldItem[] = [];
  const eyesItems: ExamObservationFieldItem[] = [];
  const rightEyeItems: ExamObservationFieldItem[] = [];
  const leftEyeItems: ExamObservationFieldItem[] = [];
  const noseItems: ExamObservationFieldItem[] = [];
  const rightEarItems: ExamObservationFieldItem[] = [];
  const leftEarItems: ExamObservationFieldItem[] = [];
  const mouthItems: ExamObservationFieldItem[] = [];
  const neckItems: ExamObservationFieldItem[] = [];
  const chestItems: ExamObservationFieldItem[] = [];
  const abdomenItems: ExamObservationFieldItem[] = [];
  const backItems: ExamObservationFieldItem[] = [];
  const skinItems: ExamObservationFieldItem[] = [];
  const skinExtraItems: string[] = [];
  const musculoskeletalItems: ExamObservationFieldItem[] = [];
  const musculoskeletalExtraItems: string[] = [];
  const neurologicalItems: ExamObservationFieldItem[] = [];
  const psychItems: ExamObservationFieldItem[] = [];
  examObservationFieldsDetailsArray.forEach((details) => {
    if (details.group === 'rightEye')
      rightEyeItems.push({ ...details, abnormal: examObservations[details.field]?.value ?? false });
    if (details.group === 'leftEye')
      leftEyeItems.push({ ...details, abnormal: examObservations[details.field]?.value ?? false });
    if (details.group === 'rightEar')
      rightEarItems.push({ ...details, abnormal: examObservations[details.field]?.value ?? false });
    if (details.group === 'leftEar')
      leftEarItems.push({ ...details, abnormal: examObservations[details.field]?.value ?? false });

    if (!examObservations[details.field]?.value) return;
    if (details.card === 'general' && ['normal', 'abnormal'].includes(details.group)) generalItems.push(details);
    if (details.card === 'general' && details.group === 'dropdown')
      generalItems.push({ ...details, label: `${details.label} distress` });
    if (details.card === 'head') headItems.push(details);
    if (details.card === 'eyes' && ['normal', 'abnormal'].includes(details.group)) eyesItems.push(details);
    if (details.card === 'nose') noseItems.push(details);
    if (details.card === 'mouth') mouthItems.push(details);
    if (details.card === 'neck') neckItems.push(details);
    if (details.card === 'chest') chestItems.push(details);
    if (details.card === 'abdomen') {
      abdomenItems.push(details.group === 'dropdown' ? { ...details, label: `Tender ${details.label}` } : details);
    }
    if (details.card === 'back') backItems.push(details);
    if (details.card === 'skin' && ['normal', 'abnormal'].includes(details.group)) skinItems.push(details);
    if (details.card === 'musculoskeletal' && ['normal', 'abnormal'].includes(details.group))
      musculoskeletalItems.push(details);
    if (details.card === 'neurological') neurologicalItems.push(details);
    if (details.card === 'psych') psychItems.push(details);
    if (details.card === 'skin' && details.group === 'form') {
      if (!skinItems.find((item) => item.label === 'Rashes')) {
        skinItems.push({ label: 'Rashes', abnormal: true } as ExamObservationFieldItem);
      }

      const resultArr: string[] = [];

      resultArr.push(rashesOptions[details.field as keyof typeof rashesOptions]);
      const note = examObservations[details.field]?.note;
      if (note) resultArr.push(note);

      skinExtraItems.push(resultArr.join(' | '));
    }
    if (details.card === 'musculoskeletal' && details.group === 'form') {
      musculoskeletalExtraItems.push(parseMusculoskeletalFieldToName(details.field));
    }
  });
  if (musculoskeletalExtraItems.length > 0)
    musculoskeletalItems.push({ label: 'Abnormal', abnormal: true } as ExamObservationFieldItem);

  const vitalsTempC = getQuestionnaireResponseByLinkId('vitals-temperature', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const vitalsTempF = vitalsTempC ? convertTemperature(vitalsTempC, 'fahrenheit') : 'N/A';
  const vitalsPulse =
    getQuestionnaireResponseByLinkId('vitals-pulse', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
  const vitalsHR =
    getQuestionnaireResponseByLinkId('vitals-hr', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
  const vitalsRR =
    getQuestionnaireResponseByLinkId('vitals-rr', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
  const vitalsBP =
    getQuestionnaireResponseByLinkId('vitals-bp', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';

  const generalProviderComment = examObservations['general-comment']?.note;
  const headProviderComment = examObservations['head-comment']?.note;
  // ???? why do we have eyes items but not in the design
  const eyesProviderComment = examObservations['eyes-comment']?.note;
  const noseProviderComment = examObservations['nose-comment']?.note;
  const earsPractitionerComment = examObservations['ears-comment']?.note;
  const mouthProviderComment = examObservations['mouth-comment']?.note;
  const neckProviderComment = examObservations['neck-comment']?.note;
  const chestProviderComment = examObservations['chest-comment']?.note;
  const abdomenProviderComment = examObservations['abdomen-comment']?.note;
  const backProviderComment = examObservations['back-comment']?.note;
  const skinProviderComment = examObservations['skin-comment']?.note;
  const musculoskeletalProviderComment = examObservations['extremities-musculoskeletal-comment']?.note;
  const neurologicalProviderComment = examObservations['neurological-comment']?.note;
  const psychProviderComment = examObservations['psych-comment']?.note;

  return {
    examination: {
      vitals: {
        temp: vitalsTempF,
        pulseOx: vitalsPulse,
        hr: vitalsHR,
        rr: vitalsRR,
        bp: vitalsBP,
      },
      general: { items: generalItems, comment: generalProviderComment },
      head: { items: headItems, comment: headProviderComment },
      eyes: { items: eyesItems, rightItems: rightEyeItems, leftItems: leftEyeItems, comment: eyesProviderComment },
      nose: { items: noseItems, comment: noseProviderComment },
      ears: { rightItems: rightEarItems, leftItems: leftEarItems, comment: earsPractitionerComment },
      mouth: { items: mouthItems, comment: mouthProviderComment },
      neck: { items: neckItems, comment: neckProviderComment },
      chest: { items: chestItems, comment: chestProviderComment },
      back: { items: backItems, comment: backProviderComment },
      skin: { items: skinItems, extraItems: skinExtraItems, comment: skinProviderComment },
      abdomen: { items: abdomenItems, comment: abdomenProviderComment },
      musculoskeletal: {
        items: musculoskeletalItems,
        extraItems: musculoskeletalExtraItems,
        comment: musculoskeletalProviderComment,
      },
      neurological: { items: neurologicalItems, comment: neurologicalProviderComment },
      psych: { items: psychItems, comment: psychProviderComment },
    },
  };
}

function parseInPersonExamFieldsFromExamObservations(chartData: GetChartDataResponse): {
  examination: InPersonExamBlockData;
} {
  const examObservations: {
    [field in ExamFieldsNames | ExamCardsNames | InPersonExamCardsNames | InPersonExamFieldsNames]?: ExamObservationDTO;
  } = {};
  chartData.examObservations?.forEach((exam) => {
    examObservations[exam.field] = exam;
  });

  const allExams = IN_PERSON_EXAM_CARDS.reduce((prev, curr) => {
    prev[curr] = { items: [] };
    return prev;
  }, {} as InPersonExamBlockData);

  inPersonExamObservationFieldsDetailsArray.forEach((details) => {
    if (!examObservations[details.field]?.value) return;

    allExams[details.card as InPersonExamTabProviderCardNames].items?.push(details);
  });

  IN_PERSON_EXAM_CARDS.forEach((card) => {
    allExams[card].comment = examObservations[`${card}-comment`]?.note;
  });

  return {
    examination: allExams,
  };
}
