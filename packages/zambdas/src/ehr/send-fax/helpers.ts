import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import {
  FAX_DOCUMENT_TYPE_LABELS,
  FaxDocumentType,
  INVALID_INPUT_ERROR,
  LAB_RESULT_DOC_REF_CODING_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
  progressNoteChartDataRequestedFields,
  Secrets,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils';
import { createDischargeSummaryPdf } from '../../shared/pdf/discharge-summary-pdf';
import {
  createPatientInstructionsPdfBytes,
  createPrescriptionsPdfBytes,
  createRadiologyResultsPdfBytes,
  hasPatientInstructionsContent,
  hasPrescriptionsContent,
  hasRadiologyResultsContent,
} from '../../shared/pdf/fax-documents-pdf';
import { getEncounterSignatures } from '../../shared/pdf/get-encounter-signatures';
import { getUpcomingFollowUps } from '../../shared/pdf/get-upcoming-follow-ups';
import { createProgressNotePdf } from '../../shared/pdf/progress-note-pdf';
import { AllChartData, FullAppointmentResourcePackage } from '../../shared/pdf/visit-details-pdf/types';
import { createPresignedUrl } from '../../shared/z3Utils';
import { getChartData } from '../get-chart-data';
import { getMedicationOrders } from '../get-medication-orders';
import { getImmunizationOrders } from '../immunization/get-orders';

const downloadPdfBytes = async (m2mToken: string, z3Url: string): Promise<Uint8Array> => {
  const presignedUrl = await createPresignedUrl(m2mToken, z3Url, 'download');
  const response = await fetch(presignedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF from ${z3Url}: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

export const searchVisitDocumentReferences = async (
  oystehr: Oystehr,
  encounterId: string,
  typeCode: string
): Promise<DocumentReference[]> => {
  return (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: 'type', value: typeCode },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-_lastUpdated' },
      ],
    })
  ).unbundle();
};

/**
 * Visit notes are linked to the visit via context.related -> Appointment, and follow-up
 * notes carry their own (follow-up) encounter in context.encounter — so unlike labs and
 * education documents they must be looked up by appointment, not by the main encounter.
 */
const searchAppointmentDocumentReferences = async (
  oystehr: Oystehr,
  appointmentId: string,
  typeCode: string
): Promise<DocumentReference[]> => {
  return (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'related', value: `Appointment/${appointmentId}` },
        { name: 'type', value: typeCode },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-_lastUpdated' },
      ],
    })
  ).unbundle();
};

const docRefPdfUrls = (docRefs: DocumentReference[]): string[] =>
  docRefs.flatMap(
    (docRef) =>
      docRef.content?.flatMap((content) => {
        const { url, contentType } = content.attachment ?? {};
        if (!url) return [];
        if (contentType && contentType !== 'application/pdf') return [];
        return [url];
      }) ?? []
  );

const fetchAllChartData = async (
  oystehr: Oystehr,
  m2mToken: string,
  visitResources: FullAppointmentResourcePackage
): Promise<AllChartData & { upcomingFollowUps: Awaited<ReturnType<typeof getUpcomingFollowUps>> }> => {
  const { encounter } = visitResources;
  const followUpParentEncounterId = encounter.partOf?.reference?.split('/')[1] ?? encounter.id!;

  const [chartDataResult, additionalChartDataResult, medicationOrdersData, immunizationOrdersData, upcomingFollowUps] =
    await Promise.all([
      getChartData(oystehr, m2mToken, encounter.id!),
      getChartData(oystehr, m2mToken, encounter.id!, progressNoteChartDataRequestedFields),
      getMedicationOrders(oystehr, {
        searchBy: {
          field: 'encounterId',
          value: encounter.id!,
        },
      }),
      getImmunizationOrders(oystehr, { encounterIds: [encounter.id!] }),
      getUpcomingFollowUps(oystehr, followUpParentEncounterId, visitResources.timezone, encounter.id),
    ]);

  return {
    chartData: chartDataResult.response,
    additionalChartData: additionalChartDataResult.response,
    medicationOrders: medicationOrdersData?.orders.filter((order) => order.status !== 'cancelled'),
    immunizationOrders: immunizationOrdersData.orders,
    upcomingFollowUps,
  };
};

interface GatherFaxDocumentsInput {
  documents: FaxDocumentType[];
  visitResources: FullAppointmentResourcePackage;
  oystehr: Oystehr;
  m2mToken: string;
  secrets: Secrets | null;
}

const NO_CONTENT_ERROR = (type: FaxDocumentType): ReturnType<typeof INVALID_INPUT_ERROR> =>
  INVALID_INPUT_ERROR(`There is no ${FAX_DOCUMENT_TYPE_LABELS[type]} content available for this visit`);

/**
 * Collects the PDF bytes for every requested document type, generating documents
 * on demand where no stored PDF exists. Returned in the canonical display order
 * of the requested `documents` array. Throws if a requested type has no content.
 */
export const gatherFaxDocuments = async (input: GatherFaxDocumentsInput): Promise<Uint8Array[]> => {
  const { documents, visitResources, oystehr, m2mToken, secrets } = input;
  const { encounter, patient } = visitResources;

  // The visit note is faxed from its stored (signed) PDF when one exists; chart data is
  // only needed for documents that are rendered on the fly.
  const visitNoteDocRefs = documents.includes('visit-note')
    ? await searchAppointmentDocumentReferences(oystehr, visitResources.appointment.id!, VISIT_NOTE_SUMMARY_CODE)
    : [];
  const existingVisitNoteUrl = docRefPdfUrls(visitNoteDocRefs)[0];

  const needsChartData =
    documents.some((type) =>
      (
        ['discharge-summary', 'prescriptions', 'patient-instructions', 'radiology-results'] as FaxDocumentType[]
      ).includes(type)
    ) ||
    (documents.includes('visit-note') && !existingVisitNoteUrl);

  const allData = needsChartData ? await fetchAllChartData(oystehr, m2mToken, visitResources) : undefined;

  const collected: Uint8Array[] = [];

  for (const type of documents) {
    switch (type) {
      case 'discharge-summary': {
        const { pdfInfo } = await createDischargeSummaryPdf(
          {
            allChartData: allData!,
            appointmentPackage: visitResources,
            upcomingFollowUps: allData!.upcomingFollowUps,
          },
          secrets,
          m2mToken
        );
        collected.push(await downloadPdfBytes(m2mToken, pdfInfo.uploadURL));
        break;
      }
      case 'visit-note': {
        if (existingVisitNoteUrl) {
          collected.push(await downloadPdfBytes(m2mToken, existingVisitNoteUrl));
        } else {
          if (!patient) throw new Error(`No patient found for encounter ${encounter.id}`);
          const signatures = await getEncounterSignatures(oystehr, encounter.id!).catch((error) => {
            console.error(`Failed to resolve encounter signatures for encounter ${encounter.id}:`, error);
            return { signedBy: undefined, approvedBy: undefined };
          });
          const { pdfInfo } = await createProgressNotePdf(
            {
              patient,
              encounter,
              allChartData: allData!,
              appointmentPackage: visitResources,
              questionnaireResponse: visitResources.questionnaireResponse,
              upcomingFollowUps: allData!.upcomingFollowUps,
              signatures,
            },
            secrets,
            m2mToken
          );
          collected.push(await downloadPdfBytes(m2mToken, pdfInfo.uploadURL));
        }
        break;
      }
      case 'lab-results': {
        const labDocRefs = await searchVisitDocumentReferences(
          oystehr,
          encounter.id!,
          `${LAB_RESULT_DOC_REF_CODING_CODE.system}|${LAB_RESULT_DOC_REF_CODING_CODE.code}`
        );
        const urls = docRefPdfUrls(labDocRefs);
        if (urls.length === 0) throw NO_CONTENT_ERROR(type);
        collected.push(...(await Promise.all(urls.map((url) => downloadPdfBytes(m2mToken, url)))));
        break;
      }
      case 'radiology-results': {
        if (!hasRadiologyResultsContent(allData!)) throw NO_CONTENT_ERROR(type);
        collected.push(
          await createRadiologyResultsPdfBytes({ allChartData: allData!, appointmentPackage: visitResources }, m2mToken)
        );
        break;
      }
      case 'prescriptions': {
        if (!hasPrescriptionsContent(allData!)) throw NO_CONTENT_ERROR(type);
        collected.push(
          await createPrescriptionsPdfBytes({ allChartData: allData!, appointmentPackage: visitResources }, m2mToken)
        );
        break;
      }
      case 'patient-instructions': {
        if (!hasPatientInstructionsContent(allData!)) throw NO_CONTENT_ERROR(type);
        collected.push(
          await createPatientInstructionsPdfBytes(
            { allChartData: allData!, appointmentPackage: visitResources },
            m2mToken
          )
        );
        break;
      }
      case 'patient-education': {
        const educationDocRefs = await searchVisitDocumentReferences(
          oystehr,
          encounter.id!,
          PATIENT_EDUCATION_DOC_TYPE_CODE
        );
        const urls = docRefPdfUrls(educationDocRefs);
        if (urls.length === 0) throw NO_CONTENT_ERROR(type);
        collected.push(...(await Promise.all(urls.map((url) => downloadPdfBytes(m2mToken, url)))));
        break;
      }
    }
  }

  return collected;
};

export const mergePdfBytes = async (pdfBytesList: Uint8Array[]): Promise<PDFDocument> => {
  const merged = await PDFDocument.create();
  for (const bytes of pdfBytesList) {
    const pdf = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return merged;
};
