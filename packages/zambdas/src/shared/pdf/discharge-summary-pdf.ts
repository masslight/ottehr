import fs from 'node:fs';
import { ContactPoint, Practitioner } from 'fhir/r4b';
import { PageSizes } from 'pdf-lib';
import {
  appointmentTypeMap,
  BUCKET_NAMES,
  CPTCodeDTO,
  formatDateToMDYWithTime,
  formatDOB,
  genderMap,
  GetChartDataResponse,
  getDefaultNote,
  GetRadiologyOrderListZambdaOutput,
  mapDispositionTypeToLabel,
  mapErxMedicationsToDisplay,
  mapMedicationsToDisplay,
  mapVitalsToDisplay,
  NOTE_TYPE,
  ParticipantInfo,
  Secrets,
  uploadDocument,
} from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { Y_POS_GAP } from './pdf-consts';
import { createPdfClient, PdfInfo, rgbNormalized } from './pdf-utils';
import { DischargeSummaryData, LineStyle, PdfClientStyles, TextStyle } from './types';
import { FullAppointmentResourcePackage } from './visit-details-pdf/types';
import { getPatientLastFirstName } from './visit-details-pdf/visit-note-pdf-creation';

type AllChartData = {
  chartData: GetChartDataResponse;
  additionalChartData?: GetChartDataResponse;
  radiologyData?: GetRadiologyOrderListZambdaOutput;
};

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

export async function composeAndCreateDischargeSummaryPdf(
  allChartData: AllChartData,
  appointmentPackage: FullAppointmentResourcePackage,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  if (!appointmentPackage.patient?.id) {
    throw new Error('Patient information is missing from the appointment package.');
  }

  console.log('Start composing data for pdf');
  const data = composeDataForDischargeSummaryPdf(allChartData, appointmentPackage);

  // attachmentUrls exist in data
  console.log('Start creating pdf');
  return await createDischargeSummaryPDF(data, appointmentPackage.patient.id, secrets, token);
}

const parseParticipantInfo = (practitioner: Practitioner): ParticipantInfo => ({
  firstName: practitioner.name?.[0]?.given?.[0] ?? '',
  lastName: practitioner.name?.[0]?.family ?? '',
});

function composeDataForDischargeSummaryPdf(
  allChartData: AllChartData,
  appointmentPackage: FullAppointmentResourcePackage
): DischargeSummaryData {
  const { chartData, additionalChartData, radiologyData } = allChartData;

  const { patient, encounter, appointment, location, practitioners, timezone } = appointmentPackage;
  if (!patient) throw new Error('No patient found for this encounter');

  const attachmentUrls: string[] = [];

  // --- Patient information ---
  const fullName = getPatientLastFirstName(patient) ?? '';
  const dob = formatDOB(patient?.birthDate) ?? '';
  const sex = genderMap[patient.gender as keyof typeof genderMap] ?? '';
  const id = patient.id ?? '';
  const phone = patient.telecom?.find((telecom: ContactPoint) => telecom.system === 'phone')?.value;

  // --- Visit information ---
  const appointmentTypeTag = appointment.meta?.tag?.find((tag) => tag.code && tag.code in appointmentTypeMap);
  const type = appointmentTypeTag?.code ? appointmentTypeMap[appointmentTypeTag.code] : 'Unknown';
  const { date = '', time = '' } = formatDateToMDYWithTime(appointment?.start) ?? {};
  const locationName = location?.name ?? '';
  const reasonForVisit = appointment?.description ?? '';

  // --- Current Medications ---
  const currentMedications = chartData.medications ? mapResourceByNameField(chartData.medications) : [];
  const currentMedicationsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.INTAKE_MEDICATION)
    ?.map((note) => note.text);

  // --- Allergies ---
  const allergies = chartData.allergies
    ? mapResourceByNameField(chartData?.allergies?.filter((allergy) => allergy.current === true))
    : [];
  const allergiesNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.ALLERGY)
    ?.map((note) => note.text);

  // --- Vitals ---
  const vitals = additionalChartData?.vitalsObservations
    ? mapVitalsToDisplay(additionalChartData.vitalsObservations, false)
    : undefined;

  // --- In-House Labs ---
  const inHouseLabs = additionalChartData?.inHouseLabResults?.labOrderResults ?? [];

  // --- Radiology ---
  const radiology = radiologyData?.orders.map((order) => ({
    name: order.studyType,
    result: order.result,
  }));

  // --- In-House Medications ---
  const inhouseMedications = additionalChartData?.inhouseMedications
    ? mapMedicationsToDisplay(additionalChartData.inhouseMedications, timezone)
    : [];

  // --- eRx ---
  const erxMedications = additionalChartData?.prescribedMedications
    ? mapErxMedicationsToDisplay(additionalChartData?.prescribedMedications, timezone)
    : [];

  // --- Assessment ---
  const diagnoses = chartData?.diagnosis
    ? {
        primary: mapResourceByNameField(chartData.diagnosis.filter((d) => d.isPrimary)),
        secondary: mapResourceByNameField(chartData.diagnosis.filter((d) => !d.isPrimary)),
      }
    : { primary: [], secondary: [] };

  // --- Patient instructions ---
  const patientInstructions: string[] = [];
  chartData?.instructions?.forEach((item) => {
    if (item.text) patientInstructions.push(item.text);
  });

  // --- General patient education documents ---
  const educationDocuments: { title: string; fileName: string }[] = [];

  // --- Discharge instructions ---
  const disposition = additionalChartData?.disposition;
  let label = '';
  let instruction = '';
  if (disposition?.type) {
    label = mapDispositionTypeToLabel[disposition.type];
    instruction = disposition.note || getDefaultNote(disposition.type);
  }

  // --- Work-school excuse ---
  const workSchoolExcuse: { note: string; fileName: string }[] = [];
  chartData.schoolWorkNotes?.forEach((ws) => {
    if (ws.url) attachmentUrls.push(ws.url);
    const fileName = ws.url?.split('/').at(-1);
    if (ws.type === 'school')
      workSchoolExcuse.push({ note: 'There was a school note generated', fileName: fileName ?? '' });
    else workSchoolExcuse.push({ note: 'There was a work note generated', fileName: fileName ?? '' });
  });

  // --- Physician information ---
  const { firstName: physicianFirstName, lastName: physicianLastName } = practitioners?.[0]
    ? parseParticipantInfo(practitioners[0])
    : {};
  const admitterParticipant = encounter.participant?.find(
    (p) => p?.type?.find((t) => t?.coding?.find((coding) => coding.code === 'ADM'))
  );
  const { date: dischargedDate, time: dischargeTime } = formatDateToMDYWithTime(admitterParticipant?.period?.end) ?? {};
  const dischargeDateTime = dischargedDate && dischargeTime ? `${dischargedDate} at ${dischargeTime}` : undefined;

  return {
    patient: {
      fullName,
      dob,
      sex,
      id,
      phone,
    },
    visit: {
      type,
      time,
      date,
      location: locationName,
      reasonForVisit,
    },
    vitals: {
      temp: vitals?.['vital-temperature']?.at(-1) ?? '',
      hr: vitals?.['vital-heartbeat']?.at(-1) ?? '',
      rr: vitals?.['vital-respiration-rate']?.at(-1) ?? '',
      bp: vitals?.['vital-blood-pressure']?.at(-1) ?? '',
      oxygenSat: vitals?.['vital-oxygen-sat']?.at(-1) ?? '',
      weight: vitals?.['vital-weight']?.at(-1) ?? '',
      height: vitals?.['vital-height']?.at(-1) ?? '',
      vision: vitals?.['vital-vision']?.at(-1) ?? '',
    },
    currentMedications,
    currentMedicationsNotes,
    allergies,
    allergiesNotes,
    inHouseLabs,
    radiology,
    inhouseMedications,
    erxMedications,
    diagnoses,
    patientInstructions,
    educationDocuments,
    disposition: {
      label,
      instruction,
    },
    physician: {
      name: `${physicianFirstName} ${physicianLastName}`,
    },
    dischargeDateTime,
    workSchoolExcuse,
    documentsAttached: true,
    attachmentUrls,
  };
}

async function createDischargeSummaryPdfBytes(data: DischargeSummaryData): Promise<Uint8Array> {
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        top: 40,
        bottom: 40,

        // Left and right margins should be 37 to fit item "* Intact recent and remote memory, judgment and insight".
        // The design of this page will be changed soon, so this simple fix is optimal for now.
        right: 37,
        left: 37,
      },
    },
  };
  const pdfClient = await createPdfClient(pdfClientStyles);
  const regularFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const boldFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Medium.ttf'));

  const textStyles: Record<string, TextStyle> = {
    header: {
      fontSize: 16,
      font: boldFont,
      side: 'right',
      spacing: 5,
      newLineAfter: true,
    },
    patientName: {
      fontSize: 16,
      font: boldFont,
      spacing: 5,
      newLineAfter: true,
    },
    subHeader: {
      fontSize: 14,
      font: boldFont,
      spacing: 5,
      newLineAfter: true,
    },
    regular: {
      fontSize: 12,
      font: regularFont,
      spacing: 2,
      newLineAfter: true,
    },
    bold: {
      fontSize: 12,
      font: boldFont,
      spacing: 2,
      newLineAfter: true,
    },
  };
  const separatedLineStyle: LineStyle = {
    thickness: 1,
    color: rgbNormalized(227, 230, 239),
    margin: {
      top: 8,
      bottom: 8,
    },
  };

  const drawHeader = (text: string, styles = textStyles.header): void => {
    pdfClient.drawText(text, styles);
  };

  const drawDescription = (styles = { ...textStyles.regular, side: 'right' as const }): void => {
    pdfClient.drawText(`${data.visit.type} | ${data.visit.time} | ${data.visit.date}`, styles);
    pdfClient.drawText(data.visit.location ?? '', styles);
  };

  const drawPatientInfo = (): void => {
    pdfClient.drawText(data.patient.fullName, textStyles.patientName);

    pdfClient.drawText(`DOB: ${data.patient.dob} | ${data.patient.sex}`, textStyles.regular);
    pdfClient.drawText(`PID: ${data.patient.id}`, textStyles.regular);
    if (data.patient.phone) {
      pdfClient.drawText(`Phone: ${data.patient.phone}`, textStyles.regular);
    }
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawReasonForVisit = (): void => {
    pdfClient.drawText('Reason for visit', textStyles.subHeader);
    pdfClient.drawText(data.visit.reasonForVisit, textStyles.regular);
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawVitalsSection = (): void => {
    pdfClient.drawText('Vitals', textStyles.subHeader);

    const vitals = [
      ['Temp', data.vitals.temp, 'Oxygen Sat', data.vitals.oxygenSat],
      ['HR', data.vitals.hr, 'Weight', data.vitals.weight],
      ['RR', data.vitals.rr, 'Height', data.vitals.height],
      ['BP', data.vitals.bp, 'Vision', data.vitals.vision],
    ];

    const leftX = pdfClient.getLeftBound();
    const colGap = 5;
    const colWidth = (pdfClient.getRightBound() - leftX - colGap) / 2;
    const rightX = leftX + colWidth + colGap;

    let y = pdfClient.getY();

    const lineHeight = textStyles.regular.font.heightAtSize(textStyles.regular.fontSize);
    const rowSpacing = 6;

    vitals.forEach(([label1, value1, label2, value2]) => {
      pdfClient.drawTextSequential(
        `${label1}: `,
        {
          ...textStyles.bold,
          newLineAfter: false,
        },
        {
          leftBound: leftX,
          rightBound: leftX + colWidth,
        }
      );

      const label1Width = pdfClient.getTextDimensions(`${label1}: `, textStyles.bold).width;
      pdfClient.drawTextSequential(
        `${value1}`,
        {
          ...textStyles.regular,
          newLineAfter: true,
        },
        {
          leftBound: leftX + label1Width,
          rightBound: leftX + label1Width + colWidth,
        }
      );

      pdfClient.setY(y);
      pdfClient.drawTextSequential(
        `${label2}: `,
        {
          ...textStyles.bold,
          newLineAfter: false,
        },
        {
          leftBound: rightX,
          rightBound: rightX + colWidth,
        }
      );

      const label2Width = pdfClient.getTextDimensions(`${label2}: `, textStyles.bold).width;
      pdfClient.drawTextSequential(
        `${value2}`,
        {
          ...textStyles.regular,
          newLineAfter: true,
        },
        {
          leftBound: rightX + label2Width,
          rightBound: rightX + label2Width + colWidth,
        }
      );

      y -= lineHeight + rowSpacing;
      pdfClient.setY(y);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawAllergies = (): void => {
    pdfClient.drawText('Known Allergies', textStyles.subHeader);
    const allergies = data.allergies?.join('; ');
    const notes = data.allergiesNotes?.length ? '; ' + data.allergiesNotes.join('; ') : '';
    const fullLine = allergies + notes;
    pdfClient.drawText(fullLine, textStyles.regular);
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawCurrentMedications = (): void => {
    pdfClient.drawText('Current Medications', textStyles.subHeader);
    const medications = data.currentMedications?.join('; ');
    const notes = data.currentMedicationsNotes?.length ? '; ' + data.currentMedicationsNotes.join('; ') : '';
    const fullLine = medications + notes;
    pdfClient.drawText(fullLine, textStyles.regular);
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawInHouseLabs = (): void => {
    pdfClient.drawText('In-House Labs', textStyles.subHeader);

    data.inHouseLabs?.forEach((lab) => {
      pdfClient.drawText(`- ${lab.name}`, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawRadiology = (): void => {
    pdfClient.drawText('Radiology', textStyles.subHeader);

    data.radiology?.forEach((r) => {
      pdfClient.drawText(r.name, textStyles.bold);
      if (r.result) pdfClient.drawText(`Final Read: ${r.result}`, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawInHouseMedications = (): void => {
    pdfClient.drawText('In-house Medications', textStyles.subHeader);

    data.inhouseMedications?.forEach((med) => {
      pdfClient.drawText(`${med.name} - ${med.dose}`, textStyles.regular);
      if (med.date) pdfClient.drawText(med.date, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawErxMedications = (): void => {
    pdfClient.drawText('eRX', textStyles.subHeader);

    data.erxMedications?.forEach((rx) => {
      pdfClient.drawText(`${rx.name}`, textStyles.bold);
      if (rx.instructions) pdfClient.drawText(rx.instructions, textStyles.regular);
      if (rx.date) pdfClient.drawText(rx.date, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawAssessment = (): void => {
    pdfClient.drawText('Assessment', textStyles.subHeader);

    pdfClient.drawText('Primary Dx', textStyles.subHeader);
    data.diagnoses?.primary.forEach((dx) => {
      pdfClient.drawText(dx, textStyles.regular);
    });
    pdfClient.drawText('Secondary Dx', textStyles.subHeader);
    data.diagnoses?.secondary.forEach((dx) => {
      pdfClient.drawText(dx, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawInstructions = (): void => {
    pdfClient.drawText('Patient Instructions', textStyles.subHeader);
    data.patientInstructions?.forEach((instr) => {
      pdfClient.drawText(`- ${instr}`, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawEducationalDocuments = (): void => {
    pdfClient.drawText('General patient education documents', textStyles.subHeader);
    data.educationDocuments?.forEach((doc) => {
      pdfClient.drawText(doc.title, textStyles.regular);
    });
    pdfClient.drawText('Documents attached', textStyles.subHeader);
    data.educationDocuments?.forEach((doc) => {
      const path = `attachments/${doc.fileName}`;
      pdfClient.drawLink(`- ${doc.fileName}`, path, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawDisposition = (): void => {
    pdfClient.drawText('Disposition', textStyles.subHeader);

    pdfClient.drawText(data.disposition.instruction, textStyles.regular);
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawWorkSchoolExcuse = (): void => {
    pdfClient.drawText('Work / School Excuse', textStyles.subHeader);
    data.workSchoolExcuse?.forEach((doc) => {
      pdfClient.drawText(doc.note, textStyles.regular);
    });

    pdfClient.drawText('Documents attached', textStyles.subHeader);
    data.workSchoolExcuse?.forEach((doc) => {
      const path = `attachments/${doc.fileName}`;
      pdfClient.drawLink(`- ${doc.fileName}`, path, textStyles.regular);
    });
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawPhysicianInfo = (): void => {
    pdfClient.drawTextSequential('Treating physician:', textStyles.bold);
    pdfClient.drawText(data.physician.name, textStyles.regular);
    if (data.dischargeDateTime) {
      pdfClient.drawText('Discharged:', textStyles.bold);
      pdfClient.drawText(data.dischargeDateTime, textStyles.regular);
    }
  };

  drawHeader('DISCHARGE SUMMARY');
  drawDescription();

  pdfClient.setY(pdfClientStyles.initialPage.height - pdfClientStyles.initialPage.pageMargins.top! - Y_POS_GAP);
  pdfClient.setX(pdfClient.getLeftBound());

  drawPatientInfo();
  if (data.visit?.reasonForVisit) drawReasonForVisit();
  if (data.currentMedications?.length || data.currentMedicationsNotes?.length) drawCurrentMedications();
  if (data.allergies?.length || data.allergiesNotes?.length) drawAllergies();
  if (Object.values(data.vitals || {}).some((val) => !!val)) drawVitalsSection();
  if (data.inHouseLabs?.length) drawInHouseLabs();
  if (data.radiology?.length) drawRadiology();
  if (data.inhouseMedications?.length) drawInHouseMedications();
  if (data.erxMedications?.length) drawErxMedications();
  if (data.diagnoses?.primary?.length || data.diagnoses?.secondary?.length) drawAssessment();
  if (data.patientInstructions?.length) drawInstructions();
  if (data.educationDocuments?.length) drawEducationalDocuments();
  if (data.disposition?.instruction) drawDisposition();
  if (data.workSchoolExcuse?.length) drawWorkSchoolExcuse();
  drawPhysicianInfo();

  return await pdfClient.save();
}

async function createDischargeSummaryPDF(
  data: DischargeSummaryData,
  patientID: string,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  if (!patientID) {
    throw new Error('No patient id found for consent items');
  }

  console.log('Creating pdf bytes');
  const pdfBytes = await createDischargeSummaryPdfBytes(data).catch((error) => {
    throw new Error('failed creating pdfBytes: ' + error.message);
  });

  console.debug(`Created discharge summary pdf bytes`);
  const bucketName = BUCKET_NAMES.DISCHARGE_SUMMARIES;

  const hasAttachments = Array.isArray(data.attachmentUrls) && data.attachmentUrls.length > 0;

  const fileName = hasAttachments ? 'DischargeSummary.zip' : 'DischargeSummary.pdf';
  console.log('Creating base file url');
  const baseFileUrl = makeZ3Url({ secrets, bucketName, patientID, fileName });
  console.log('Uploading file to bucket');
  await uploadDocument(pdfBytes, baseFileUrl, token, patientID, data.attachmentUrls).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  return { title: fileName, uploadURL: baseFileUrl };
}
