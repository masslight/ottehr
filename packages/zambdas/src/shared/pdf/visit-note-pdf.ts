import { Patient } from 'fhir/r4b';
import fs from 'fs';
import { PageSizes, PDFImage } from 'pdf-lib';
import {
  BUCKET_NAMES,
  followUpInOptions,
  formatFhirEncounterToPatientFollowupDetails,
  isFollowupEncounter,
  NonNormalResult,
  NonNormalResultContained,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
  renderScreeningQuestionsForPDF,
  Secrets,
  VitalFieldNames,
} from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { ICON_STYLE } from './pdf-consts';
import { createPdfClient, getPdfLogo, PdfInfo, rgbNormalized } from './pdf-utils';
import { ImageStyle, LineStyle, PageStyles, PdfClientStyles, TextStyle, VisitNoteData } from './types';

async function createVisitNotePdfBytes(
  data: VisitNoteData,
  isInPersonAppointment: boolean,
  encounter?: any
): Promise<Uint8Array> {
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

  const RubikFont = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Regular.otf'));
  const RubikFontBold = await pdfClient.embedFont(fs.readFileSync('./assets/Rubik-Bold.otf'));
  const logoBuffer = await getPdfLogo();
  let logo: PDFImage | undefined;
  if (logoBuffer) logo = await pdfClient.embedImage(logoBuffer);
  const redDot = await pdfClient.embedImage(fs.readFileSync('./assets/red-dot.png'));
  const greenDot = await pdfClient.embedImage(fs.readFileSync('./assets/green-dot.png'));

  const textStyles: Record<string, TextStyle> = {
    header: {
      fontSize: 20,
      font: RubikFontBold,
      spacing: 17,
      side: 'right',
      newLineAfter: true,
    },
    subHeader: {
      fontSize: 14,
      font: RubikFontBold,
      spacing: 5,
      newLineAfter: true,
    },
    blockHeader: {
      fontSize: 18,
      spacing: 8,
      font: RubikFont,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    blockSubHeader: {
      fontSize: 16,
      spacing: 1,
      font: RubikFontBold,
      newLineAfter: true,
      color: rgbNormalized(48, 19, 103),
    },
    fieldHeader: {
      fontSize: 16,
      font: RubikFont,
      spacing: 1,
      color: rgbNormalized(48, 19, 103),
    },
    fieldText: {
      fontSize: 16,
      spacing: 6,
      font: RubikFont,
      side: 'right',
      newLineAfter: true,
    },
    regularText: {
      fontSize: 16,
      spacing: 1,
      font: RubikFont,
      newLineAfter: true,
    },
    alternativeRegularText: {
      fontSize: 16,
      spacing: 1,
      color: rgbNormalized(143, 154, 167),
      font: RubikFont,
      newLineAfter: true,
    },
    smallText: {
      fontSize: 14,
      spacing: 1,
      font: RubikFont,
      newLineAfter: true,
    },
    smallGreyText: {
      fontSize: 14,
      spacing: 1,
      font: RubikFont,
      newLineAfter: true,
      color: rgbNormalized(143, 154, 167),
    },
    examCardHeader: {
      fontSize: 16,
      spacing: 1,
      font: RubikFontBold,
      color: rgbNormalized(48, 19, 103),
    },
    examBoldField: {
      fontSize: 16,
      spacing: 5,
      font: RubikFontBold,
    },
    examRegularField: {
      fontSize: 16,
      spacing: 5,
      font: RubikFont,
    },
    examProviderComment: {
      fontSize: 16,
      spacing: 16,
      font: RubikFontBold,
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

  const drawFieldLine = (name: string, value: string): void => {
    const leftBound = pdfClient.getLeftBound();
    const labelWidth = pdfClient.getTextDimensions(name || '', textStyles.fieldHeader).width + 10;

    pdfClient.drawText(name || '', textStyles.fieldHeader);
    pdfClient.setLeftBound(leftBound + labelWidth);

    pdfClient.drawText(value || '', textStyles.fieldText);
    pdfClient.setLeftBound(leftBound);
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
    cardContent?: Array<{ label: string; abnormal: boolean; field: string }>,
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

  const isFollowup = encounter ? isFollowupEncounter(encounter) : false;

  // This is headline of each line
  const drawHeadline = (): void => {
    const imgStyles: ImageStyle = {
      width: 110,
      height: 28,
    };
    if (logo) pdfClient.drawImage(logo, imgStyles);
    const title = isFollowup ? 'Follow-up Visit Note' : 'Visit Note';
    pdfClient.drawText(title, textStyles.header);
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

  if (isFollowup && encounter) {
    const followupDetails = formatFhirEncounterToPatientFollowupDetails(encounter, data.patientName);

    const followupDateTime = encounter.period?.start
      ? new Date(encounter.period.start).toLocaleString()
      : data.dateOfService;

    drawFieldLine('Initial visit date', data.dateOfService);
    drawFieldLine('Follow-up date and time', followupDateTime);

    if (followupDetails.reason) {
      drawFieldLine('Reason', followupDetails.reason);
    }
    if (followupDetails.reason === 'Other' && followupDetails.otherReason) {
      drawFieldLine('Other reason', followupDetails.otherReason);
    }
    if (followupDetails.provider?.name) {
      drawFieldLine('Follow-up provider', followupDetails.provider.name);
    }
    if (followupDetails.location) {
      drawFieldLine('Location', followupDetails.location.name || '');
    }
    if (followupDetails.message) {
      drawFieldLine('Comment', followupDetails.message);
    }
  } else {
    drawFieldLine('Date of Service', data.dateOfService);
    drawFieldLine('Reason for Visit', data.reasonForVisit);
    drawFieldLine('Provider', data.provider);
    if (data.intakePerson) {
      drawFieldLine('Intake completed by', data.intakePerson);
    }
    drawFieldLine('Signed On', data.signedOn);
    drawFieldLine('Visit ID', data.visitID);
    drawFieldLine('Visit State', data.visitState);
    if (data.insuranceCompany) {
      drawFieldLine('Insurance Company', data.insuranceCompany);
    }
    if (data.insuranceSubscriberId) {
      drawFieldLine('Subscriber ID', data.insuranceSubscriberId);
    }
    drawFieldLine('Address', data.address);
  }
  regularText(
    // Related to a node bug, a second space(good space) was added between the words gave, their to handle a bad space(no space) occurrence
    'Provider confirmed patient’s name, DOB, introduced themselves, and gave their licensure and credentials.'
  );
  separateLine();

  if (!isFollowup) {
    if (data.chiefComplaint || data.providerTimeSpan) {
      drawBlockHeader('Chief complaint & History of Present Illness');
      if (data.chiefComplaint && data.chiefComplaint.length > 0) {
        regularText(data.chiefComplaint);
      }
      if (data.providerTimeSpan && !isInPersonAppointment) {
        pdfClient.drawText(
          `Provider spent ${data.providerTimeSpan} minutes on real-time audio & video with this patient`,
          textStyles.smallGreyText
        );
      }
      separateLine();
    }

    if (data.mechanismOfInjury) {
      drawBlockHeader('Mechanism of Injury');
      regularText(data.mechanismOfInjury);
      separateLine();
    }

    if (data.reviewOfSystems) {
      drawBlockHeader('Review of Systems');
      regularText(data.reviewOfSystems);
      separateLine();
    }
  }

  if (data.medications || (data.medicationsNotes && data.medicationsNotes.length > 0)) {
    drawBlockHeader('Medications');
    if (data.medications?.length) {
      data.medications.forEach((medication) => {
        pdfClient.drawText(medication, textStyles.regularText);
      });
    } else {
      pdfClient.drawText('No current medications', textStyles.regularText);
    }

    if (data.medicationsNotes && data.medicationsNotes.length > 0) {
      drawBlockHeader('Medications notes', textStyles.blockSubHeader);
      data.medicationsNotes.forEach((record) => {
        regularText(record);
      });
    }

    separateLine();
  }

  if (data.allergies || (data.allergiesNotes && data.allergiesNotes.length > 0)) {
    drawBlockHeader('Allergies');
    if (data.allergies?.length) {
      data.allergies.forEach((allergy) => {
        pdfClient.drawText(allergy, textStyles.regularText);
      });
    } else {
      pdfClient.drawText('No known allergies', textStyles.regularText);
    }

    if (data.allergiesNotes && data.allergiesNotes.length > 0) {
      drawBlockHeader('Allergies notes', textStyles.blockSubHeader);
      data.allergiesNotes.forEach((record) => {
        regularText(record);
      });
    }

    separateLine();
  }

  if (data.medicalConditions || (data.medicalConditionsNotes && data.medicalConditionsNotes.length > 0)) {
    drawBlockHeader('Medical Conditions');
    if (data.medicalConditions?.length) {
      data.medicalConditions.forEach((medicalCondition) => {
        pdfClient.drawText(medicalCondition, textStyles.regularText);
      });
    } else {
      pdfClient.drawText('No known medical conditions', textStyles.regularText);
    }

    if (data.medicalConditionsNotes && data.medicalConditionsNotes.length > 0) {
      drawBlockHeader('Medical conditions notes', textStyles.blockSubHeader);
      data.medicalConditionsNotes.forEach((record) => {
        regularText(record);
      });
    }

    separateLine();
  }

  if (data.surgicalHistory || (data.surgicalHistoryNotes && data.surgicalHistoryNotes.length > 0)) {
    drawBlockHeader('Surgical history');
    if (data.surgicalHistory?.length) {
      data.surgicalHistory.forEach((record) => {
        regularText(record);
      });
    } else {
      regularText('No surgical history');
    }

    if (data.surgicalHistoryNotes && data.surgicalHistoryNotes.length > 0) {
      drawBlockHeader('Surgical history notes', textStyles.blockSubHeader);
      data.surgicalHistoryNotes.forEach((record) => {
        regularText(record);
      });
    }

    separateLine();
  }

  if (data.hospitalization || (data.hospitalizationNotes && data.hospitalizationNotes.length > 0)) {
    drawBlockHeader('Hospitalization');
    if (data.hospitalization?.length) {
      data.hospitalization.forEach((record) => {
        regularText(record);
      });
    } else {
      regularText('No hospitalizations');
    }

    if (data.hospitalizationNotes && data.hospitalizationNotes.length > 0) {
      drawBlockHeader('Hospitalization notes', textStyles.blockSubHeader);
      data.hospitalizationNotes.forEach((record) => {
        regularText(record);
      });
    }

    separateLine();
  }

  if (
    (data.inHouseMedications && data.inHouseMedications.length > 0) ||
    (data.inHouseMedicationsNotes && data.inHouseMedicationsNotes.length > 0)
  ) {
    drawBlockHeader('In-House Medications');
    if (data.inHouseMedications?.length) {
      data.inHouseMedications.forEach((record) => {
        regularText(record);
      });
    } else {
      regularText('No in-house medications');
    }

    if (data.inHouseMedicationsNotes && data.inHouseMedicationsNotes.length > 0) {
      drawBlockHeader('In-House Medications notes', textStyles.blockSubHeader);
      data.inHouseMedicationsNotes.forEach((record) => {
        regularText(record);
      });
    }

    separateLine();
  }

  if (data.immunizationOrders && data.immunizationOrders.length > 0) {
    drawBlockHeader('Immunization');
    data.immunizationOrders.forEach((record) => {
      regularText(record);
    });
    separateLine();
  }
  // result flag icons
  const inconclusiveIcon = await pdfClient.embedImage(fs.readFileSync('./assets/inconclusive.png'));
  const abnormalIcon = await pdfClient.embedImage(fs.readFileSync('./assets/abnormal.png'));
  const normalIcon = await pdfClient.embedImage(fs.readFileSync('./assets/normal.png'));

  const regularTextNoLineAfter = { ...textStyles.regularText, newLineAfter: false };
  const getFlagsExcludingNeutral = (flags: NonNormalResult[]): NonNormalResult[] =>
    flags.filter((flag) => flag !== NonNormalResult.Neutral);

  const getCurBounds = (): { leftBound: number; rightBound: number } => ({
    leftBound: pdfClient.getX(),
    rightBound: pdfClient.getRightBound(),
  });
  const drawResultFlags = (
    nonNormalResultContained: NonNormalResultContained,
    labType: 'inhouse' | 'external'
  ): void => {
    const resultFlagIconStyle = { ...ICON_STYLE, margin: { left: 5, right: 5 } };
    if (nonNormalResultContained && nonNormalResultContained.length > 0) {
      const flagsExcludingNeutral = getFlagsExcludingNeutral(nonNormalResultContained);
      if (flagsExcludingNeutral?.length) {
        flagsExcludingNeutral.forEach((flag, idx) => {
          const lastFlag = flagsExcludingNeutral?.length === idx + 1;
          const style = lastFlag ? textStyles.regularText : regularTextNoLineAfter;

          if (flag === NonNormalResult.Abnormal) {
            pdfClient.drawImage(abnormalIcon, resultFlagIconStyle, regularTextNoLineAfter);
            pdfClient.drawTextSequential('Abnormal', { ...style, color: rgbNormalized(237, 108, 2) }, getCurBounds());
          } else if (flag === NonNormalResult.Inconclusive) {
            pdfClient.drawImage(inconclusiveIcon, resultFlagIconStyle, regularTextNoLineAfter);
            pdfClient.drawTextSequential(
              'Inconclusive',
              { ...style, color: rgbNormalized(117, 117, 117) },
              getCurBounds()
            );
          }
        });
      }
    } else if (labType === 'inhouse') {
      // too hairy to assume normal results for external labs so we will only do this for inhouse
      pdfClient.drawImage(normalIcon, resultFlagIconStyle, regularTextNoLineAfter);
      pdfClient.drawTextSequential(
        'Normal',
        { ...textStyles.regularText, color: rgbNormalized(46, 125, 50) },
        getCurBounds()
      );
    }
  };

  const getTestNameTextStyle = (
    nonNormalResultContained: NonNormalResultContained,
    labType: 'inhouse' | 'external'
  ): TextStyle => {
    // results are normal, no flags
    if (!nonNormalResultContained) {
      if (labType === 'inhouse') {
        // there will be a normal flag therefore the test name should not have a new line after it is written
        return regularTextNoLineAfter;
      } else {
        // no normal flag therefore the test name should have a new line after it is written
        return textStyles.regularText;
      }
    }

    const flagsExcludingNeutral = getFlagsExcludingNeutral(nonNormalResultContained);
    if (flagsExcludingNeutral.length > 0) {
      // results have a flag to display therefore the test name should not have a new line after it is written
      return regularTextNoLineAfter;
    } else {
      // no flags for neutral tests, new line after test name
      return textStyles.regularText;
    }
  };

  const drawInHouseLabs = (): void => {
    pdfClient.drawText('In-House Labs', textStyles.subHeader);
    if (data.inHouseLabs?.orders.length) {
      pdfClient.drawText('Orders:', textStyles.subHeader);
      data.inHouseLabs?.orders.forEach((order) => {
        pdfClient.drawText(order.testItemName, textStyles.regularText);
      });
    }
    if (data.inHouseLabs?.results.length) {
      pdfClient.drawText('Results:', textStyles.subHeader);
      data.inHouseLabs?.results.forEach((result) => {
        const testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'inhouse');
        pdfClient.drawTextSequential(result.name, testNameTextStyle, {
          leftBound: pdfClient.getLeftBound(),
          rightBound: pdfClient.getRightBound(),
        });
        drawResultFlags(result.nonNormalResultContained, 'inhouse');
      });
    }
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  const drawExternalLabs = (): void => {
    pdfClient.drawText('External Labs', textStyles.subHeader);
    if (data.externalLabs?.orders.length) {
      pdfClient.drawText('Orders:', textStyles.subHeader);
      data.externalLabs?.orders.forEach((order) => {
        pdfClient.drawText(order.testItemName, textStyles.regularText);
      });
    }
    if (data.externalLabs?.results.length) {
      pdfClient.drawText('Results:', textStyles.subHeader);
      data.externalLabs?.results.forEach((result) => {
        const testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'external');
        pdfClient.drawTextSequential(result.name, testNameTextStyle, {
          leftBound: pdfClient.getLeftBound(),
          rightBound: pdfClient.getRightBound(),
        });
        drawResultFlags(result.nonNormalResultContained, 'external');
      });
    }
    pdfClient.drawSeparatedLine(separatedLineStyle);
  };

  if (data.inHouseLabs?.orders.length || data.inHouseLabs?.results.length) drawInHouseLabs();
  if (data.externalLabs?.orders.length || data.externalLabs?.results.length) drawExternalLabs();

  if (!isFollowup) {
    if (
      (data.screening?.additionalQuestions && Object.keys(data.screening.additionalQuestions).length > 0) ||
      data.screening?.currentASQ ||
      (data.screening?.notes && data.screening.notes.length > 0)
    ) {
      drawBlockHeader('Additional questions');

      if (data.screening?.additionalQuestions) {
        renderScreeningQuestionsForPDF(data.screening.additionalQuestions, (question, formattedValue) => {
          regularText(`${question} - ${formattedValue}`);
        });
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

    if (data.intakeNotes && data.intakeNotes.length > 0) {
      drawBlockHeader('Intake notes');
      data.intakeNotes.forEach((record) => {
        regularText(record);
      });
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
        [VitalFieldNames.VitalLastMenstrualPeriod]: 'Last Menstrual Period',
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
  }

  if (!isFollowup) {
    drawBlockHeader('Examination');

    // Process examination data using the new structure
    const examination = data.examination;

    if (examination && Object.keys(examination).length > 0) {
      Object.entries(examination).forEach(([sectionKey, section]) => {
        if (section.items && section.items.length > 0) {
          const sectionLabel = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
          drawExaminationCard(`${sectionLabel}:   `, section.items, undefined, section.comment);
        } else if (section.comment) {
          // If there are no items but there's a comment, still show the section
          const sectionLabel = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
          drawExaminationCard(`${sectionLabel}:   `, [], undefined, section.comment);
        }
      });
    }
    separateLine();

    if (data.assessment?.primary) {
      drawBlockHeader('Assessment');
      drawBlockHeader('Primary:', textStyles.blockSubHeader);
      regularText(data.assessment?.primary);
      if (data.assessment?.secondary.length > 0) {
        drawBlockHeader('Secondary:', textStyles.blockSubHeader);
        data.assessment?.secondary.forEach((assessment) => {
          regularText(assessment);
        });
      }
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
  }

  if (data.procedures && data.procedures.length > 0) {
    drawBlockHeader('Procedures');
    data.procedures.forEach((procedure) => {
      drawBlockHeader(procedure.procedureType ?? '', textStyles.blockSubHeader);
      regularText(
        procedure.cptCodes != null && procedure.cptCodes.length > 0
          ? 'CPT: ' + procedure.cptCodes.join('; ')
          : undefined
      );
      regularText(
        procedure.diagnoses != null && procedure.diagnoses.length > 0
          ? 'Dx: ' + procedure.diagnoses.join('; ')
          : undefined
      );

      regularText(
        procedure.procedureDateTime != null
          ? 'Date and time of the procedure: ' + procedure.procedureDateTime
          : undefined
      );
      regularText(procedure.performerType != null ? 'Performed by: ' + procedure.performerType : undefined);
      regularText(
        procedure.medicationUsed != null ? 'Anaesthesia / medication used: ' + procedure.medicationUsed : undefined
      );
      regularText(procedure.bodySite != null ? 'Site/location: ' + procedure.bodySite : undefined);
      regularText(procedure.bodySide != null ? 'Side of body: ' + procedure.bodySide : undefined);
      regularText(procedure.technique != null ? 'Technique: ' + procedure.technique : undefined);
      regularText(
        procedure.suppliesUsed != null ? 'Instruments / supplies used: ' + procedure.suppliesUsed : undefined
      );
      regularText(procedure.procedureDetails != null ? 'Procedure details: ' + procedure.procedureDetails : undefined);
      regularText(procedure.specimenSent != null ? 'Specimen sent: ' + procedure.specimenSent : undefined);
      regularText(procedure.complications != null ? 'Complications: ' + procedure.complications : undefined);
      regularText(procedure.patientResponse != null ? 'Patient response: ' + procedure.patientResponse : undefined);
      regularText(
        procedure.postInstructions != null ? 'Post-procedure instructions: ' + procedure.postInstructions : undefined
      );
      regularText(procedure.timeSpent != null ? 'Time spent: ' + procedure.timeSpent : undefined);
      regularText(procedure.documentedBy != null ? 'Documented by: ' + procedure.documentedBy : undefined);
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
    data.disposition.followUpIn ||
    data.disposition.reason ||
    (data.subSpecialtyFollowUp && data.subSpecialtyFollowUp.length > 0) ||
    (data.workSchoolExcuse && data.workSchoolExcuse.length > 0)
  ) {
    drawBlockHeader('Plan');
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
      data.disposition.virusTest ||
      data.disposition.followUpIn ||
      data.disposition.reason
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
      if (typeof data.disposition.followUpIn === 'number') {
        regularText(
          `Follow-up visit ${
            data.disposition.followUpIn === 0
              ? followUpInOptions.find((option) => option.value === data.disposition.followUpIn)?.label
              : `in ${followUpInOptions.find((option) => option.value === data.disposition.followUpIn)?.label}`
          }`
        );
      }
      if (data.disposition.reason) {
        regularText(`Reason for transfer: ${data.disposition.reason}`);
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
      drawBlockHeader('School / Work Excuse', textStyles.blockSubHeader);
      data.workSchoolExcuse.forEach((item) => {
        regularText(item);
      });
      separateLine();
    }

    if (data.addendumNote) {
      drawBlockHeader('Addendum', textStyles.blockSubHeader);
      regularText(data.addendumNote);
    }
  }

  if (isFollowup && encounter) {
    const completedDateTime = encounter.period?.end
      ? new Date(encounter.period.end).toLocaleString()
      : new Date().toLocaleString();
    drawFieldLine('Follow-up completed', completedDateTime);
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
  isInPersonAppointment: boolean,
  encounter?: any
): Promise<PdfInfo> {
  if (!patient.id) {
    throw new Error('No patient id found for consent items');
  }

  console.log('Creating pdf bytes');
  const pdfBytes = await createVisitNotePdfBytes(input, isInPersonAppointment, encounter).catch((error) => {
    throw new Error('failed creating pdfBytes: ' + error.message);
  });

  console.debug(`Created visit note pdf bytes`);
  const bucketName = BUCKET_NAMES.VISIT_NOTES;
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
