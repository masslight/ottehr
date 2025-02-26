import Oystehr from '@oystehr/sdk';
import { Patient, Questionnaire, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { getCanonicalQuestionnaire } from 'utils';
import { assertDefined } from '../shared/helpers';

export interface Document {
  patientInfo: PatientInfo;
  sections: Section[];
  imageItems: ImageItem[];
}

export interface PatientInfo {
  name: string;
  id: string;
}

export interface Section {
  title: string;
  items: Item[];
}

export interface Item {
  question: string;
  answer: string;
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

export async function createDocument(questionnaireResponseId: string, oystehr: Oystehr): Promise<Document> {
  const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    id: questionnaireResponseId,
  });
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
  return {
    patientInfo: {
      name: patient.name?.[0].family + ', ' + patient.name?.[0].given,
      id: patient.id ?? '',
    },
    sections: createSections(questionnaireResponse, questionnaire),
    imageItems: createImageItems(questionnaireResponse, questionnaire, oystehr),
  };
}

function createSections(questionnaireResponse: QuestionnaireResponse, questionnaire: Questionnaire): Section[] {
  return (questionnaireResponse.item ?? []).flatMap<Section>((sectionItem) => {
    const questionItemSection = getItem(sectionItem.linkId, questionnaire);
    const title = questionItemSection?.text;
    const items = (sectionItem.item ?? []).flatMap<Item>((item) => {
      const question = getItem(item.linkId, questionItemSection)?.text;
      const answer = item.answer?.[0]?.valueString;
      if (question == null || answer == null) {
        return [];
      }
      return [
        {
          question,
          answer,
        },
      ];
    });
    if (title == null || items.length === 0) {
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
  return (questionnaireResponse.item ?? []).flatMap<ImageItem>((sectionItem) => {
    const questionItemSection = getItem(sectionItem.linkId, questionnaire);
    return (sectionItem.item ?? []).flatMap((item) => {
      const title = getItem(item.linkId, questionItemSection)?.text;
      const attachment = item.answer?.[0]?.valueAttachment;
      const url = attachment?.url;
      if (title == null || attachment == null || url == null) {
        return [];
      }
      let imageType: ImageType | undefined = undefined;
      if (attachment.contentType === 'image/jpeg') {
        imageType = ImageType.JPG;
      }
      if (attachment.contentType === 'image/png') {
        imageType = ImageType.PNG;
      }
      if (imageType == null) {
        return [];
      }
      return [
        {
          title,
          imageType,
          imageBytes: downloadImage(url, oystehr),
        },
      ];
    });
  });
}

function getItem(
  linkId: string,
  obj?: {
    item?: QuestionnaireResponseItem[] | undefined;
  }
): QuestionnaireResponseItem | undefined {
  return obj?.item?.find((item) => item.linkId === linkId);
}

function fetchQuestionnaire(questionnaire: string, oystehr: Oystehr): Promise<Questionnaire> {
  if (questionnaire.includes('|')) {
    const [questionnaireURL, questionnaireVersion] = questionnaire.split('|');
    return getCanonicalQuestionnaire(
      {
        url: questionnaireURL,
        version: questionnaireVersion,
      },
      oystehr
    );
  }
  return oystehr.fhir.get({
    resourceType: 'Questionnaire',
    id: questionnaire,
  });
}

async function downloadImage(url: string, oystehr: Oystehr): Promise<ArrayBuffer> {
  const pathTokens = url.substring(url.indexOf('/z3/') + 4).split('/');
  return oystehr.z3.downloadFile({
    bucketName: pathTokens[0],
    'objectPath+': pathTokens.slice(1).join('/'),
  });
}
