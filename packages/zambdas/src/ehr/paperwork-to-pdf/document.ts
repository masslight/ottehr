import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Location,
  Patient,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  Schedule,
} from 'fhir/r4b';
import { formatDateToMDYWithTime, getAppointmentType, getCanonicalQuestionnaire } from 'utils';
import { assertDefined, resolveTimezone } from '../../shared/helpers';

export interface Document {
  patientInfo: PatientInfo;
  visitInfo: VisitInfo;
  sections: Section[];
  imageItems: ImageItem[];
}

export interface PatientInfo {
  name: string;
  id: string;
}

export interface VisitInfo {
  type: string;
  time: string;
  date: string;
  location?: string;
}

export interface Section {
  title: string;
  items: Item[];
}

export interface Item {
  question: string;
  answer: string;
  group?: string;
}

export enum ImageType {
  JPG,
  PNG,
}

export interface ImageItem {
  title: string;
  imageType: ImageType;
  imageBytes: Promise<ArrayBuffer>;
}

export async function createDocument(
  questionnaireResponse: QuestionnaireResponse,
  appointment: Appointment,
  oystehr: Oystehr,
  schedule?: Schedule,
  location?: Location
): Promise<Document> {
  const questionnaire = await fetchQuestionnaire(
    assertDefined(questionnaireResponse.questionnaire, 'questionnaireResponse.questionnaire'),
    oystehr
  );
  const [subjectType, subjectId] = (questionnaireResponse.subject?.reference ?? '').split('/');
  if (subjectType !== 'Patient') {
    throw new Error(`Only "Patient" subject is supported but was "${subjectType}"`);
  }
  const patient = await oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: subjectId,
  });

  const { type } = getAppointmentType(appointment);
  const timezone = resolveTimezone(schedule, location);
  const { date = '', time = '' } = formatDateToMDYWithTime(appointment?.start, timezone ?? 'America/New_York') ?? {};
  const locationName = location?.name ?? '';

  return {
    patientInfo: {
      name: patient.name?.[0].family + ', ' + patient.name?.[0].given,
      id: patient.id ?? '',
    },
    visitInfo: {
      type,
      time,
      date,
      location: locationName,
    },
    sections: createSections(questionnaireResponse, questionnaire),
    imageItems: createImageItems(questionnaireResponse, questionnaire, oystehr),
  };
}

function findQuestionnaireItem(linkId: string, items?: QuestionnaireItem[] | undefined): QuestionnaireItem | undefined {
  if (!items) return undefined;
  for (const it of items) {
    if (!it) continue;
    if (it.linkId === linkId) return it;
    const found = findQuestionnaireItem(linkId, it.item);
    if (found) return found;
  }
  return undefined;
}

function createSections(questionnaireResponse: QuestionnaireResponse, questionnaire: Questionnaire): Section[] {
  function extractAnswerValue(answerItem: QuestionnaireResponseItemAnswer): string | null {
    const v =
      answerItem?.valueString ??
      answerItem?.valueBoolean ??
      answerItem?.valueDecimal ??
      answerItem?.valueInteger ??
      answerItem?.valueDate ??
      answerItem?.valueTime ??
      answerItem?.valueDateTime ??
      answerItem?.valueQuantity?.value ??
      answerItem?.valueReference?.display;
    if (v == null) return null;
    return v.toString();
  }

  function collectItems(
    questionnaireResponseItems: QuestionnaireResponseItem[] | undefined,
    parentQuestionnaireItems?: QuestionnaireItem[] | undefined,
    groupName?: string
  ): Item[] {
    const collected: Item[] = [];
    if (!questionnaireResponseItems) return collected;

    for (const questionnaireResponseItem of questionnaireResponseItems) {
      if (!questionnaireResponseItem) continue;

      let questionnaireItem = findQuestionnaireItem(questionnaireResponseItem.linkId, parentQuestionnaireItems);
      if (!questionnaireItem) {
        questionnaireItem = findQuestionnaireItem(questionnaireResponseItem.linkId, questionnaire.item);
      }

      const questionText = questionnaireItem?.text;

      if (questionnaireResponseItem.answer && questionnaireResponseItem.answer.length > 0) {
        const answers = questionnaireResponseItem.answer
          .flatMap((answer) => {
            const value = extractAnswerValue(answer);
            return value == null ? [] : [value];
          })
          .join();

        if (questionText && answers.length > 0) {
          const item: Item = { question: questionText, answer: answers };
          if (groupName) {
            item.group = groupName;
          }
          collected.push(item);
        }
      }

      if (questionnaireResponseItem.item && questionnaireResponseItem.item.length > 0) {
        const nextParentQItems = questionnaireItem?.item ?? parentQuestionnaireItems;
        const childItems = collectItems(questionnaireResponseItem.item, nextParentQItems, questionText);
        collected.push(...childItems);
      }
    }

    return collected;
  }

  return (questionnaireResponse.item ?? []).flatMap<Section>((sectionItem) => {
    const sectionDef = findQuestionnaireItem(sectionItem.linkId, questionnaire.item);
    const title = sectionDef?.text ?? sectionItem.linkId;

    const items = collectItems(sectionItem.item, sectionDef?.item ?? questionnaire.item);

    if (!title || items.length === 0) {
      return [];
    }
    return {
      title,
      items,
    };
  });
}

function createImageItems(
  questionnaireResponse: QuestionnaireResponse,
  questionnaire: Questionnaire,
  oystehr: Oystehr
): ImageItem[] {
  const collected: ImageItem[] = [];

  collectImageItems(questionnaireResponse.item, questionnaire.item, oystehr, collected, questionnaire);

  return collected;
}

function collectImageItems(
  responseItems: QuestionnaireResponseItem[] | undefined,
  parentQuestionnaireItems: QuestionnaireItem[] | undefined,
  oystehr: Oystehr,
  collected: ImageItem[],
  questionnaire: Questionnaire
): void {
  if (!responseItems) return;

  for (const item of responseItems) {
    const questionnaireItem = findQuestionnaireItem(item.linkId, parentQuestionnaireItems ?? questionnaire.item);
    const title = questionnaireItem?.text;
    const attachment = item.answer?.[0]?.valueAttachment;

    if (attachment?.url && attachment?.contentType) {
      let imageType: ImageType | undefined;
      if (attachment.contentType === 'image/jpeg') imageType = ImageType.JPG;
      if (attachment.contentType === 'image/png') imageType = ImageType.PNG;

      if (imageType) {
        collected.push({
          title: title ?? attachment.title ?? item.linkId,
          imageType,
          imageBytes: downloadImage(attachment.url, oystehr),
        });
      }
    }

    if (item.item && item.item.length > 0) {
      collectImageItems(
        item.item,
        questionnaireItem?.item ?? parentQuestionnaireItems,
        oystehr,
        collected,
        questionnaire
      );
    }
  }
}

function fetchQuestionnaire(questionnaire: string, oystehr: Oystehr): Promise<Questionnaire> {
  const [questionnaireURL, questionnaireVersion] = questionnaire.split('|');
  return getCanonicalQuestionnaire(
    {
      url: questionnaireURL,
      version: questionnaireVersion,
    },
    oystehr
  );
}

async function downloadImage(url: string, oystehr: Oystehr): Promise<ArrayBuffer> {
  const pathTokens = url.substring(url.indexOf('/z3/') + 4).split('/');
  return oystehr.z3.downloadFile({
    bucketName: pathTokens[0],
    'objectPath+': pathTokens.slice(1).join('/'),
  });
}
