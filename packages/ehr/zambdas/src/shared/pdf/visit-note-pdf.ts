import { Patient } from 'fhir/r4b';
import fs from 'fs';
import { PageSizes } from 'pdf-lib';
import {
  AdditionalBooleanQuestionsFieldsNames,
  ExamObservationFieldItem,
  IN_PERSON_EXAM_CARDS,
  InPersonExamObservationFieldItem,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
  SEEN_IN_LAST_THREE_YEARS_LABEL,
  VitalFieldNames,
} from 'utils';
import { makeZ3Url, Secrets } from 'zambda-utils';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { createPdfClient, PdfInfo, rgbNormalized } from './pdf-utils';
import {
  ImageStyle,
  InPersonExamBlockData,
  LineStyle,
  PageStyles,
  PdfClientStyles,
  TelemedExamBlockData,
  TextStyle,
  VisitNoteData,
} from './types';

async function createVisitNotePdfBytes(data: VisitNoteData, isInPersonAppointment: boolean): Promise<Uint8Array> {
  const pdfClientStyles: PdfClientStyles = {
    initialPage: {
      width: PageSizes.A4[0],
      height: PageSizes.A4[1],
      pageMargins: {
        left: 40,
        top: 40,
        right: 40,
        bottom: 40,
      },
    },
  };
  const pdfClient = await createPdfClient(pdfClientStyles);

  const RobotoFont = await pdfClient.embedFont(fs.readFileSync('./Roboto-Regular.otf'));
  const RobotoFontBold = await pdfClient.embedFont(fs.readFileSync('./Roboto-Bold.otf'));
  const tiemposFontRegular = await pdfClient.embedFont(fs.readFileSync('./TiemposHeadline-Regular.otf'));
  const ottehrLogo = await pdfClient.embedImage(fs.readFileSync('./ottehrLogo.png'));
  const redDot = await pdfClient.embedImage(fs.readFileSync('./red-dot.png'));
  const greenDot = await pdfClient.embedImage(fs.readFileSync('./green-dot.png'));

  const textStyles: Record<string, TextStyle> = {
    header: {
      fontSize: 20,
      font: RobotoFontBold,
      spacing: 17,
      side: 'right',
      newLineAfter: true,
    },
    blockHeader: {
      fontSize: 18,
      spacing: 8,
      font: tiemposFontRegular,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    blockSubHeader: {
      fontSize: 16,
      spacing: 1,
      font: RobotoFontBold,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    fieldHeader: {
      fontSize: 16,
      font: RobotoFont,
      spacing: 1,
      color: rgbNormalized(48, 19, 103),
    },
    fieldText: {
      fontSize: 16,
      spacing: 6,
      font: RobotoFont,
      side: 'right',
      newLineAfter: true,
    },
    regularText: {
      fontSize: 16,
      spacing: 1,
      font: RobotoFont,
      newLineAfter: true,
    },
    alternativeRegularText: {
      fontSize: 16,
      spacing: 1,
      color: rgbNormalized(143, 154, 167),
      font: RobotoFont,
      newLineAfter: true,
    },
    smallText: {
      fontSize: 14,
      spacing: 1,
      font: RobotoFont,
      newLineAfter: true,
    },
    smallGreyText: {
      fontSize: 14,
      spacing: 1,
      font: RobotoFont,
      newLineAfter: true,
      color: rgbNormalized(143, 154, 167),
    },
    examCardHeader: {
      fontSize: 16,
      spacing: 1,
      font: RobotoFontBold,
      color: rgbNormalized(48, 19, 103),
    },
    examBoldField: {
      fontSize: 16,
      spacing: 5,
      font: RobotoFontBold,
    },
    examRegularField: {
      fontSize: 16,
      spacing: 5,
      font: RobotoFont,
    },
    examProviderComment: {
      fontSize: 16,
      spacing: 16,
      font: RobotoFontBold,
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
  const examColorDotsStyle: ImageStyle = {
    width: 10,
    height: 10,
  };
  const examExtraItemsSeparatedLineStyle: LineStyle = {
    thickness: 1,
    color: rgbNormalized(244, 246, 248),
    margin: {
      right: 200,
    },
  };

  const drawBlockHeader = (text: string, styles = textStyles.blockHeader): void => {
    const headerTextDims = pdfClient.getTextDimensions(text, styles);
    const regularTextDims = pdfClient.getTextDimensions('a', textStyles.regularText);
    if (
      pdfClient.getY() - headerTextDims.height - (styles.newLineAfter ? styles.spacing : 0) - regularTextDims.height <
      (pdfClientStyles.initialPage.pageMargins.bottom ?? 0)
    ) {
      pdfClient.addNewPage(pdfClientStyles.initialPage);
    }
    pdfClient.drawText(text, styles);
  };

  const drawFieldLine = (fieldName: string, fieldValue: string): void => {
    pdfClient.drawText(fieldName, textStyles.fieldHeader);
    pdfClient.drawText(fieldValue, textStyles.fieldText);
  };

  const separateLine = (): void => {
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const regularText = (text?: string, alternativeText?: string): void => {
    if (text) pdfClient.drawText(text, textStyles.regularText);
    else if (alternativeText) pdfClient.drawText(alternativeText, textStyles.alternativeRegularText);
  };

  const drawExaminationCard = (
    cardHeader: string,
    cardContent?: (ExamObservationFieldItem | InPersonExamObservationFieldItem)[],
    extraItems?: string[],
    cardComment?: string
  ): void => {
    if ((cardContent && cardContent.length > 0) || cardComment) {
      pdfClient.drawTextSequential(cardHeader, textStyles.examCardHeader);
      if (cardContent && cardContent.length > 0) {
        const headerDims = pdfClient.getTextDimensions(cardHeader, textStyles.examCardHeader);
        pdfClient.setLeftBound(pdfClient.getLeftBound() + headerDims.width);
        cardContent.forEach((item) => {
          const itemText = ` ${item.label}   `;
          const textDimensions = pdfClient.getTextDimensions(itemText, textStyles.examBoldField);
          if (textDimensions.width + examColorDotsStyle.width + pdfClient.getX() > pdfClient.getRightBound())
            pdfClient.newLine(textDimensions.height + textStyles.examBoldField.spacing);
          if (item.abnormal) {
            pdfClient.drawImage(redDot, examColorDotsStyle, textStyles.examBoldField);
            pdfClient.drawTextSequential(itemText, textStyles.examBoldField);
          } else {
            pdfClient.drawImage(greenDot, examColorDotsStyle, textStyles.examRegularField);
            pdfClient.drawTextSequential(itemText, textStyles.examRegularField);
          }
        });
        pdfClient.setLeftBound(pdfClient.getLeftBound() - headerDims.width);
      }
      if (extraItems || [].length > 0) {
        pdfClient.newLine(
          pdfClient.getTextDimensions('A', textStyles.examRegularField).height + textStyles.examRegularField.spacing
        );
        drawExtraItems(extraItems);
      } else {
        pdfClient.newLine(pdfClient.getTextDimensions('a', textStyles.examRegularField).height + 2);
      }
      if (cardComment) drawExamProviderComment(cardComment);
    }
  };

  const drawExamProviderComment = (comment?: string): void => {
    if (!comment) {
      pdfClient.setY(pdfClient.getY() - 16);
      return;
    }
    // +8 we add as margin between exam cards and comments
    pdfClient.setY(pdfClient.getY() - 8);
    pdfClient.drawText(comment, textStyles.examProviderComment);
  };

  const drawExtraItems = (extraItems?: string[]): void => {
    if (!extraItems) return;
    extraItems.forEach((item, index) => {
      pdfClient.drawText(item, textStyles.regularText);
      if (index + 1 < extraItems.length) pdfClient.drawSeparatedLine(examExtraItemsSeparatedLineStyle);
    });
  };

  const drawExaminationYesNoItems = (cardHeader: string, cardContent: ExamObservationFieldItem[]): void => {
    pdfClient.drawTextSequential(cardHeader, textStyles.examCardHeader);
    const headerDims = pdfClient.getTextDimensions(cardHeader, textStyles.examCardHeader);
    pdfClient.setLeftBound(pdfClient.getLeftBound() + headerDims.width);
    cardContent.forEach((item) => {
      const itemText = `${item.label} ${item.abnormal ? ' -  Yes   ' : ' - No   '}`;
      if (item.label === 'Normal') {
        if (item.abnormal) pdfClient.drawTextSequential(itemText, textStyles.examRegularField);
        else pdfClient.drawTextSequential(itemText, textStyles.examBoldField);
      } else {
        if (item.abnormal) pdfClient.drawTextSequential(itemText, textStyles.examBoldField);
        else pdfClient.drawTextSequential(itemText, textStyles.examRegularField);
      }
    });
    pdfClient.setLeftBound(pdfClient.getLeftBound() - headerDims.width);
    pdfClient.newLine(pdfClient.getTextDimensions('a', textStyles.examRegularField).height + 2);
  };

  // This is headline of each line
  const drawHeadline = (): void => {
    const imgStyles: ImageStyle = {
      width: 110,
      height: 28,
    };
    pdfClient.drawImage(ottehrLogo, imgStyles);
    pdfClient.drawText('Visit Note', textStyles.header);
  };
  // We can't set this headline in initial styles, so we gonna draw it and add
  // it as headline for all next pages to set automatically
  drawHeadline();
  const pageStylesWithHeadline: PageStyles = {
    ...pdfClientStyles.initialPage,
    setHeadline: drawHeadline,
  };
  pdfClient.setPageStyles(pageStylesWithHeadline);

  // --- add all sections to PDF ---
  // ===============================
  drawBlockHeader('Patient information');
  drawFieldLine('Patient name', data.patientName);
  drawFieldLine('Date of birth', data.patientDOB);
  if (data.personAccompanying) {
    drawFieldLine('Person accompanying the minor patient', data.personAccompanying);
  }
  if (data.patientPhone) {
    drawFieldLine('Phone', data.patientPhone);
  }
  separateLine();

  drawBlockHeader('Visit Details');
  drawFieldLine('Date of Service', data.dateOfService);
  drawFieldLine('Reason for Visit', data.reasonForVisit);
  drawFieldLine('Provider', data.provider);
  drawFieldLine('Signed On', data.signedOn);
  drawFieldLine('Visit ID', data.visitID);
  drawFieldLine('Visit State', data.visitState);
  if (data.insuranceCompany) {
    drawFieldLine('Insurance Company', data.insuranceCompany);
  }
  if (data.insuranceSubscriberId) {
    drawFieldLine('Subscriber ID', data.insuranceSubscriberId);
  }
  regularText("Provider confirmed patient's name, DOB, introduced myself and gave my licensure and credentials");
  pdfClient.drawText(`Address: ${data.address}`, textStyles.smallText);
  separateLine();

  if (data.chiefComplaint || data.providerTimeSpan) {
    drawBlockHeader('Chief complaint & History of Present Illness');
    if (data.chiefComplaint && data.chiefComplaint.length > 0) {
      regularText(data.chiefComplaint);
    }
    if (data.providerTimeSpan) {
      pdfClient.drawText(
        `Provider spent ${data.providerTimeSpan} minutes on real-time audio & video with this patient`,
        textStyles.smallGreyText
      );
    }
    separateLine();
  }

  if (data.reviewOfSystems) {
    drawBlockHeader('Review of Systems');
    regularText(data.reviewOfSystems);
    separateLine();
  }

  if (data.medications && data.medications.length > 0) {
    drawBlockHeader('Medications');
    data.medications?.forEach((medication) => {
      pdfClient.drawText(medication, textStyles.regularText);
    });
    separateLine();
  }

  if (data.allergies && data.allergies.length > 0) {
    drawBlockHeader('Allergies');
    data.allergies?.forEach((allergy) => {
      pdfClient.drawText(allergy, textStyles.regularText);
    });
    separateLine();
  }

  if (data.medicalConditions && data.medicalConditions.length > 0) {
    drawBlockHeader('Medical Conditions');
    data.medicalConditions.forEach((medicalCondition) => {
      pdfClient.drawText(medicalCondition, textStyles.regularText);
    });
    separateLine();
  }

  if (data.surgicalHistory && data.surgicalHistory.length > 0) {
    drawBlockHeader('Surgical history');
    data.surgicalHistory.forEach((record) => {
      regularText(record);
    });
    separateLine();
  }

  if (data.hospitalization && data.hospitalization.length > 0) {
    drawBlockHeader('Hospitalization');
    data.hospitalization.forEach((record) => {
      regularText(record);
    });
    separateLine();
  }

  if (
    Object.values(data.additionalQuestions).some((value) => value !== '') ||
    data.screening?.seenInLastThreeYears ||
    data.screening?.historyObtainedFrom ||
    data.screening?.currentASQ ||
    (data.screening?.notes && data.screening.notes.length > 0)
  ) {
    drawBlockHeader('Additional questions');
    if (data.additionalQuestions[AdditionalBooleanQuestionsFieldsNames.CovidSymptoms]) {
      regularText(
        `Do you have any COVID symptoms? - ${
          data.additionalQuestions[AdditionalBooleanQuestionsFieldsNames.CovidSymptoms]
        }`
      );
    }
    if (data.additionalQuestions[AdditionalBooleanQuestionsFieldsNames.TestedPositiveCovid]) {
      regularText(
        `Have you tested positive for COVID? - ${
          data.additionalQuestions[AdditionalBooleanQuestionsFieldsNames.TestedPositiveCovid]
        }`
      );
    }
    if (data.additionalQuestions[AdditionalBooleanQuestionsFieldsNames.TravelUsa]) {
      regularText(
        `Have you traveled out of the USA in the last 2 weeks? - ${
          data.additionalQuestions[AdditionalBooleanQuestionsFieldsNames.TravelUsa]
        }`
      );
    }

    if (data.screening?.seenInLastThreeYears) {
      regularText(`${SEEN_IN_LAST_THREE_YEARS_LABEL} - ${data.screening.seenInLastThreeYears}`);
    }

    if (data.screening?.historyObtainedFrom) {
      regularText(
        `History obtained from - ${data.screening.historyObtainedFrom}${
          data.screening.historyObtainedFromOther ? `: ${data.screening.historyObtainedFromOther}` : ''
        }`
      );
    }

    if (data.screening?.currentASQ) {
      regularText(`ASQ - ${data.screening.currentASQ}`);
    }

    if (data.screening?.notes && data.screening.notes.length > 0) {
      drawBlockHeader('Screening notes', textStyles.blockSubHeader);
      data.screening.notes.forEach((record) => {
        regularText(record);
      });
    }
    separateLine();
  }

  if (data.vitals && (Object.values(data.vitals).filter((arr) => arr && arr.length > 0) ?? []).length > 0) {
    drawBlockHeader('Vitals');

    const vitalLabelMapper: { [value in VitalFieldNames]: string } & { notes: string } = {
      [VitalFieldNames.VitalTemperature]: 'Temperature',
      [VitalFieldNames.VitalHeartbeat]: 'Heartbeat',
      [VitalFieldNames.VitalRespirationRate]: 'Respiration rate',
      [VitalFieldNames.VitalBloodPressure]: 'Blood pressure',
      [VitalFieldNames.VitalOxygenSaturation]: 'Oxygen saturation',
      [VitalFieldNames.VitalWeight]: 'Weight',
      [VitalFieldNames.VitalHeight]: 'Height',
      [VitalFieldNames.VitalVision]: 'Vision',
      notes: 'Vitals notes',
    };

    Object.keys(vitalLabelMapper)
      .filter((name) => data.vitals?.[name as VitalFieldNames] && data.vitals?.[name as VitalFieldNames]!.length > 0)
      .forEach((vitalName) => {
        drawBlockHeader(vitalLabelMapper[vitalName as VitalFieldNames], textStyles.blockSubHeader);
        data.vitals?.[vitalName as VitalFieldNames]?.forEach((record) => {
          regularText(record);
        });
      });

    separateLine();
  }

  drawBlockHeader('Examination');

  if (isInPersonAppointment) {
    const examination = data.examination as InPersonExamBlockData;

    IN_PERSON_EXAM_CARDS.forEach((card) => {
      drawExaminationCard(
        `${String(card).charAt(0).toUpperCase() + String(card).slice(1)}:   `,
        examination[card].items,
        undefined,
        examination[card].comment
      );
    });
  } else {
    const examination = data.examination as TelemedExamBlockData;

    const headerDims = pdfClient.getTextDimensions('Vitals (patient provided): ', textStyles.examCardHeader);
    pdfClient.drawTextSequential('Vitals (patient provided): ', textStyles.examCardHeader);
    pdfClient.setLeftBound(pdfClient.getLeftBound() + headerDims.width);
    pdfClient.drawTextSequential('     Temp: ', textStyles.examBoldField);
    pdfClient.drawTextSequential(examination.vitals.temp, textStyles.examRegularField);
    pdfClient.drawTextSequential('     PulseOx: ', textStyles.examBoldField);
    pdfClient.drawTextSequential(examination.vitals.pulseOx, textStyles.examRegularField);
    pdfClient.drawTextSequential('     HR: ', textStyles.examBoldField);
    pdfClient.drawTextSequential(examination.vitals.hr, textStyles.examRegularField);
    pdfClient.newLine(pdfClient.getTextDimensions('a', textStyles.examRegularField).height);
    pdfClient.drawTextSequential('     RR: ', textStyles.examBoldField);
    pdfClient.drawTextSequential(examination.vitals.rr, textStyles.examRegularField);
    pdfClient.drawTextSequential('     BP: ', textStyles.examBoldField);
    pdfClient.drawTextSequential(examination.vitals.bp, textStyles.examRegularField);
    pdfClient.setLeftBound(pdfClient.getLeftBound() - headerDims.width);
    // +16 we add as margin between two exam cards
    pdfClient.newLine(pdfClient.getTextDimensions('a', textStyles.examRegularField).height + 16);

    drawExaminationCard('General:   ', examination.general.items, undefined, examination.general.comment);
    drawExaminationCard('Head:   ', examination.head.items, undefined, examination.head.comment);
    drawExaminationYesNoItems('Right eye:   ', examination.eyes.rightItems!);
    drawExaminationYesNoItems('Left eye:   ', examination.eyes.leftItems!);
    drawExamProviderComment(examination.eyes.comment);
    drawExaminationCard('Nose:   ', examination.nose.items, undefined, examination.nose.comment);
    drawExaminationYesNoItems('Right ear:   ', examination.ears.rightItems!);
    drawExaminationYesNoItems('Left ear:   ', examination.ears.leftItems!);
    drawExamProviderComment(examination.ears.comment);
    drawExaminationCard('Mouth:   ', examination.mouth.items, undefined, examination.mouth.comment);
    drawExaminationCard('Neck:   ', examination.neck.items, undefined, examination.neck.comment);
    drawExaminationCard('Chest:   ', examination.chest.items, undefined, examination.chest.comment);
    drawExaminationCard('Abdomen:   ', examination.abdomen.items, undefined, examination.abdomen.comment);
    drawExaminationCard('Back:   ', examination.back.items, undefined, examination.back.comment);
    drawExaminationCard('Skin:   ', examination.skin.items, examination.skin.extraItems, examination.skin.comment);
    drawExaminationCard(
      'Extremities/Musculoskeletal:   ',
      examination.musculoskeletal.items,
      examination.musculoskeletal.extraItems,
      examination.musculoskeletal.comment
    );
    drawExaminationCard(
      'Neurological:   ',
      examination.neurological.items,
      undefined,
      examination.neurological.comment
    );
    drawExaminationCard('Psych:   ', examination.psych.items, undefined, examination.psych.comment);
  }
  separateLine();

  if (data.assessment?.primary) {
    drawBlockHeader('Assessment');
    regularText(data.assessment?.primary);
    separateLine();
  }

  if (data.medicalDecision) {
    drawBlockHeader('Medical Decision Making');
    regularText(data.medicalDecision);
    separateLine();
  }

  if (data.emCode) {
    drawBlockHeader('E&M code');
    regularText(data.emCode, 'No E&M code provided.');
    separateLine();
  }

  if (data.cptCodes && data.cptCodes.length > 0) {
    drawBlockHeader('CPT codes');
    data.cptCodes.forEach((cptCode) => {
      regularText(cptCode);
    });
    separateLine();
  }

  if (data.prescriptions && data.prescriptions.length > 0) {
    drawBlockHeader('Prescriptions');
    data.prescriptions.forEach((prescription) => {
      regularText(prescription);
    });
    separateLine();
  }

  // drawBlockHeader('General patient education documents');
  // regularText('To be implemented');
  // separateLine();

  if (
    data.disposition.text ||
    data.disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ||
    data.disposition.labService ||
    data.disposition.virusTest ||
    (data.subSpecialtyFollowUp && data.subSpecialtyFollowUp.length > 0) ||
    (data.workSchoolExcuse && data.workSchoolExcuse.length > 0)
  ) {
    drawBlockHeader('Patient instructions');
    if (data.patientInstructions && data.patientInstructions.length > 0) {
      drawBlockHeader('Patient instructions', textStyles.blockSubHeader);
      data.patientInstructions.forEach((instruction) => {
        regularText(instruction);
      });
      separateLine();
    }

    if (
      data.disposition.text ||
      data.disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] ||
      data.disposition.labService ||
      data.disposition.virusTest
    ) {
      drawBlockHeader(data.disposition.header, textStyles.blockSubHeader);
      if (data.disposition.text) {
        regularText(data.disposition.text);
      }
      if (data.disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD]) {
        regularText(NOTHING_TO_EAT_OR_DRINK_LABEL);
      }
      if (data.disposition.labService) {
        regularText(`Lab Services: ${data.disposition.labService}`);
      }
      if (data.disposition.virusTest) {
        regularText(`Virus Tests: ${data.disposition.virusTest}`);
      }
      separateLine();
    }

    if (data.subSpecialtyFollowUp && data.subSpecialtyFollowUp.length > 0) {
      drawBlockHeader('Subspecialty follow-up', textStyles.blockSubHeader);
      data.subSpecialtyFollowUp.forEach((followUp) => {
        regularText(followUp);
      });
      separateLine();
    }

    if (data.workSchoolExcuse && data.workSchoolExcuse.length > 0) {
      drawBlockHeader('Work / School Excuse', textStyles.blockSubHeader);
      data.workSchoolExcuse.forEach((item) => {
        regularText(item);
      });
    }
  }

  return await pdfClient.save();
}

async function uploadPDF(pdfBytes: Uint8Array, token: string, baseFileUrl: string): Promise<void> {
  const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);
}

export async function createVisitNotePDF(
  input: VisitNoteData,
  patient: Patient,
  secrets: Secrets | null,
  token: string,
  isInPersonAppointment: boolean
): Promise<PdfInfo> {
  if (!patient.id) {
    throw new Error('No patient id found for consent items');
  }

  console.log('Creating pdf bytes');
  const pdfBytes = await createVisitNotePdfBytes(input, isInPersonAppointment).catch((error) => {
    throw new Error('failed creating pdfBytes: ' + error.message);
  });

  console.debug(`Created visit note pdf bytes`);
  const bucketName = 'visit-notes';
  const fileName = 'VisitNote.pdf';
  console.log('Creating base file url');
  const baseFileUrl = makeZ3Url({ secrets, bucketName, patientID: patient.id, fileName });
  console.log('Uploading file to bucket');
  await uploadPDF(pdfBytes, token, baseFileUrl).catch((error) => {
    throw new Error('failed uploading pdf to z3: ' + error.message);
  });

  // for testing
  // savePdfLocally(pdfBytes);

  return { title: fileName, uploadURL: baseFileUrl };
}
