import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { StandardFonts } from 'pdf-lib';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  getPresignedURL,
  LabelConfig,
  LabelPdf,
  LabelXml,
  Secrets,
} from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../z3Utils';
import { convertLabeConfigToPdfClientStyles } from './external-labs-label-pdf';
import { uploadLabelXmlToZ3 } from './helpers/fileHelpers';
import { Y_POS_GAP as pdfClientGapSubtraction } from './pdf-consts';
import { createPdfClient, PdfInfo } from './pdf-utils';
import { TextStyle } from './types';

const VISIT_LABEL_PDF_BASE_NAME = 'VisitLabel';
const VISIT_LABEL_XML_BASE_NAME = 'VisitLabel-xml';

export const VISIT_LABEL_DOC_TYPE_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/visit-label';

export const VISIT_LABEL_PDF_DOC_REF_DOCTYPE = {
  system: VISIT_LABEL_DOC_TYPE_SYSTEM,
  code: 'visit-label',
  display: 'Visit Label',
};

export const VISIT_LABEL_XML_DOC_REF_DOCTYPE = {
  system: VISIT_LABEL_DOC_TYPE_SYSTEM,
  code: 'visit-label-xml',
  display: 'Visit Label',
};

const DATE_FORMAT = 'MM/dd/yyyy';

interface VisitLabelContent {
  patientLastName: string;
  patientFirstName: string;
  patientMiddleName?: string;
  patientId: string;
  patientDateOfBirth: DateTime | undefined;
  patientGender: string;
  visitDate: DateTime | undefined;
  visitTimeZone: string | undefined;
}

export interface VisitLabelConfig {
  labelConfig: LabelConfig;
  content: VisitLabelContent;
}

const createVisitLabelPdfBytes = async (data: VisitLabelConfig): Promise<Uint8Array> => {
  const { labelConfig, content } = data;

  const pdfClientStyles = convertLabeConfigToPdfClientStyles(labelConfig);

  const pdfClient = await createPdfClient(pdfClientStyles);
  // the pdf client initializes YPos to some non-zero number and it's causing huge gaps
  pdfClient.setY(pdfClient.getY() + pdfClientGapSubtraction - 15);

  const CourierBold = await pdfClient.embedStandardFont(StandardFonts.CourierBold);
  const Courier = await pdfClient.embedStandardFont(StandardFonts.Courier);

  const baseFontSize = 7;
  const baseSpacing = 2;

  const textStyles: Record<string, TextStyle> = {
    fieldText: {
      fontSize: baseFontSize,
      spacing: baseSpacing,
      font: Courier,
      newLineAfter: false,
    },
    fieldTextBold: {
      fontSize: baseFontSize,
      spacing: baseSpacing,
      font: CourierBold,
      newLineAfter: false,
    },
    fieldHeader: {
      fontSize: baseFontSize,
      font: CourierBold,
      spacing: baseSpacing,
    },
  };

  const NEWLINE_Y_DROP =
    pdfClient.getTextDimensions('Any text used to get height', textStyles.fieldHeader).height + baseSpacing;

  const drawHeaderAndInlineText = (header: string, text: string): void => {
    pdfClient.drawTextSequential(`${header}: `, textStyles.fieldHeader);
    pdfClient.drawTextSequential(text, textStyles.fieldTextBold);
  };

  /**
   * Label format looks like:
   *
   * PID:
   * patientLast, patientFirst, patientMiddle
   * DOB: mm/dd/yyyy (#years old yo), gender
   * Visit date: mm/dd/yyyy
   */

  const {
    patientId,
    patientFirstName,
    patientMiddleName,
    patientLastName,
    patientDateOfBirth,
    patientGender,
    visitDate,
    visitTimeZone,
  } = content;

  // expect this to print in the system timezone
  console.log('this is DateTime.toFormat no zone', visitDate?.toFormat(DATE_FORMAT + ' ZZZ'));
  if (visitTimeZone) {
    // this prints out with the appropriate schedule
    console.log(
      'this is DateTime.toFormat with zone',
      visitDate?.setZone(visitTimeZone).toFormat(DATE_FORMAT + ' ZZZ')
    );
  } else console.log('no zone in visitTimeZone');

  drawHeaderAndInlineText('PID', patientId);
  pdfClient.newLine(NEWLINE_Y_DROP);

  pdfClient.drawTextSequential(getPatientNameForLabelDisplay(patientLastName, patientFirstName, patientMiddleName), {
    ...textStyles.fieldHeader,
    fontSize: textStyles.fieldHeader.fontSize + 2,
  });
  pdfClient.newLine(NEWLINE_Y_DROP);

  drawHeaderAndInlineText('DOB', getPatientDOBAndSexForLabelDisplay(patientDateOfBirth, patientGender));
  pdfClient.newLine(NEWLINE_Y_DROP);

  drawHeaderAndInlineText('Visit date', getVisitDateForLabelDisplay(visitDate, visitTimeZone));

  return await pdfClient.save();
};

const getPatientNameForLabelDisplay = (patientLast: string, patientFirst: string, patientMiddle?: string): string => {
  return `${patientLast}, ${patientFirst}${patientMiddle ? `, ${patientMiddle}` : ''}`;
};

const getPatientDOBAndSexForLabelDisplay = (dob: DateTime | undefined, sex: string): string => {
  const patientDOBString = dob ? dob.toFormat(DATE_FORMAT) : '';

  const getAgeString = (dob: DateTime | undefined): string => {
    if (!dob || dob.toUTC() > DateTime.utc()) return '';

    // get the date diff between now and the dob
    // const ageInMonths = Math.round(DateTime.utc().diff(dob.toUTC(), ['months', 'weeks', 'days']).as('months'));
    const { months, weeks, days } = DateTime.utc().diff(dob.toUTC(), ['months', 'weeks', 'days']).toObject();
    if (!months && !weeks && days !== undefined) {
      return `${days} d`;
    }

    if (!months && weeks !== undefined) return `${weeks} wk`;

    if (months !== undefined) {
      if (months <= 24) return `${months} mo`;
      else {
        return `${Math.floor(months / 12)} yr`;
      }
    }

    throw new Error(`Error processing age string for dob ${dob}`);
  };
  const ageString = getAgeString(dob);
  const renderAgeString = ageString ? `(${ageString})` : '';

  return `${patientDOBString} ${renderAgeString}, ${sex}`;
};

const getVisitDateForLabelDisplay = (visitDate: DateTime | undefined, visitTimeZone: string | undefined): string => {
  return visitDate ? visitDate.setZone(visitTimeZone ? visitTimeZone : 'UTC').toFormat(DATE_FORMAT) : '';
};

async function createVisitLabelPDFHelper(
  input: VisitLabelConfig,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Creating visit label pdf bytes');

  const pdfBytes = await createVisitLabelPdfBytes(input).catch((error) => {
    throw new Error('failed creating visit label pdfBytes: ' + error.message);
  });

  console.log(`Created visit label pdf bytes`);

  const fileName = `${VISIT_LABEL_PDF_BASE_NAME}-${
    input.content.visitDate ? input.content.visitDate.toFormat(DATE_FORMAT) : ''
  }.pdf`;

  console.log(`Creating base file url for file ${fileName}`);

  const baseFileUrl = makeZ3Url({
    secrets,
    fileName,
    bucketName: BUCKET_NAMES.VISIT_NOTES,
    patientID: input.content.patientId,
  });

  console.log('Uploading file to bucket, ', BUCKET_NAMES.VISIT_NOTES);

  try {
    const presignedUrl = await createPresignedUrl(token, baseFileUrl, 'upload');
    await uploadObjectToZ3(pdfBytes, presignedUrl);
  } catch (error: any) {
    throw new Error(`failed uploading pdf ${fileName} to z3:  ${JSON.stringify(error.message)}`);
  }

  // for testing
  // savePdfLocally(pdfBytes);

  return { title: fileName, uploadURL: baseFileUrl };
}

export async function createVisitLabel(
  labelConfig: VisitLabelConfig,
  encounterId: string,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<{
  visitLabelPdf: LabelPdf;
  visitLabelXml: LabelXml;
}> {
  const [visitLabelPdf, visitLabelXml] = await Promise.all([
    createVisitLabelPDF(labelConfig, encounterId, secrets, token, oystehr),
    createVisitLabelXml(labelConfig, encounterId, secrets, token, oystehr),
  ]);

  return {
    visitLabelPdf: { ...visitLabelPdf, type: 'label' },
    visitLabelXml: { ...visitLabelXml, type: 'xml-label' },
  };
}

async function createVisitLabelPDF(
  labelConfig: VisitLabelConfig,
  encounterId: string,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<{ documentReference: DocumentReference; presignedURL: string }> {
  const pdfInfo = await createVisitLabelPDFHelper(labelConfig, secrets, token);

  console.log(`This is the made pdfInfo`, JSON.stringify(pdfInfo));

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: pdfInfo.uploadURL, title: pdfInfo.title }],
    type: { coding: [VISIT_LABEL_PDF_DOC_REF_DOCTYPE], text: 'Visit label' },
    references: {
      subject: {
        reference: `Patient/${labelConfig.content.patientId}`,
      },
      context: {
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    searchParams: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    generateUUID: randomUUID,
    listResources: [], // this for whatever reason needs to get added otherwise the function never adds the new docRef to the returned array
  });

  console.log(`These are the docRefs returned for the label: `, JSON.stringify(docRefs));

  if (!docRefs.length) {
    throw new Error('Unable to make docRefs for label');
  }

  const presignedURL = await getPresignedURL(pdfInfo.uploadURL, token);

  if (!presignedURL) {
    throw new Error('Failed to get presigned URL for visit label PDF');
  }

  return { documentReference: docRefs[0], presignedURL };
}

async function createVisitLabelXml(
  labelConfig: VisitLabelConfig,
  encounterId: string,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<{ documentReference: DocumentReference; presignedURL: string }> {
  const xmlString = createVisitLabelXmlString(labelConfig.content);

  console.log('Visit labek xml string: ', xmlString);
  const fileName = `${VISIT_LABEL_XML_BASE_NAME}-${
    labelConfig.content.visitDate ? labelConfig.content.visitDate.toFormat(DATE_FORMAT) : ''
  }.xml`;

  const baseFileUrl = await uploadLabelXmlToZ3(
    xmlString,
    fileName,
    BUCKET_NAMES.VISIT_NOTES,
    labelConfig.content.patientId,
    token,
    secrets
  );

  const { docRefs } = await createFilesDocumentReferences({
    files: [{ url: baseFileUrl, title: fileName }],
    type: { coding: [VISIT_LABEL_XML_DOC_REF_DOCTYPE], text: 'Visit label xml' },
    references: {
      subject: {
        reference: `Patient/${labelConfig.content.patientId}`,
      },
      context: {
        encounter: [{ reference: `Encounter/${encounterId}` }],
      },
    },
    docStatus: 'final',
    dateCreated: DateTime.now().setZone('UTC').toISO() ?? '',
    oystehr,
    searchParams: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    generateUUID: randomUUID,
    listResources: [], // this for whatever reason needs to get added otherwise the function never adds the new docRef to the returned array
  });

  console.log(`These are the docRefs returned for the xml visit label: `, JSON.stringify(docRefs));

  if (!docRefs.length) {
    throw new Error('Unable to make docRefs for xml visit label');
  }

  const presignedURL = await getPresignedURL(baseFileUrl, token);

  if (!presignedURL) {
    throw new Error('Failed to get presigned URL for visit label PDF');
  }

  return { documentReference: docRefs[0], presignedURL };
}

// This is for the 30334 label. PID is on two lines for now to avoid truncating. Can change once the friendly ID is added
const createVisitLabelXmlString = (content: VisitLabelContent): string => {
  return `
  <?xml version="1.0" encoding="utf-8"?>
<DesktopLabel Version="1">
  <DYMOLabel Version="4">
    <Description>DYMO Label</Description>
    <Orientation>Portrait</Orientation>
    <LabelName>Small30334</LabelName>
    <InitialLength>0</InitialLength>
    <BorderStyle>SolidLine</BorderStyle>
    <DYMORect>
      <DYMOPoint>
        <X>0.039999966</X>
        <Y>0.060000002</Y>
      </DYMOPoint>
      <Size>
        <Width>2.17</Width>
        <Height>1.13</Height>
      </Size>
    </DYMORect>
    <BorderColor>
      <SolidColorBrush>
        <Color A="1" R="0" G="0" B="0"></Color>
      </SolidColorBrush>
    </BorderColor>
    <BorderThickness>1</BorderThickness>
    <Show_Border>False</Show_Border>
    <HasFixedLength>False</HasFixedLength>
    <FixedLengthValue>0</FixedLengthValue>
    <DynamicLayoutManager>
      <RotationBehavior>ClearObjects</RotationBehavior>
      <LabelObjects>
        <TextObject>
          <Name>PID line 1</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>None</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>None</FitMode>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>PID:</Text>
                <FontInfo>
                  <FontName>Courier New</FontName>
                  <FontSize>7</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.03999997</X>
              <Y>0.09090942</Y>
            </DYMOPoint>
            <Size>
              <Width>2.04938</Width>
              <Height>0.22315212</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>PID line 2</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>None</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>None</FitMode>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>${content.patientId}</Text>
                <FontInfo>
                  <FontName>Courier New</FontName>
                  <FontSize>7</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.04000002</X>
              <Y>0.28714654</Y>
            </DYMOPoint>
            <Size>
              <Width>2.0558572</Width>
              <Height>0.1467135</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>Patient Name</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>None</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>None</FitMode>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>${getPatientNameForLabelDisplay(
                  content.patientLastName,
                  content.patientFirstName,
                  content.patientMiddleName
                )}</Text>
                <FontInfo>
                  <FontName>Courier New</FontName>
                  <FontSize>9</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.03999997</X>
              <Y>0.43386006</Y>
            </DYMOPoint>
            <Size>
              <Width>2.1700017</Width>
              <Height>0.13361889</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>DOB</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>None</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>None</FitMode>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>DOB: ${getPatientDOBAndSexForLabelDisplay(
                  content.patientDateOfBirth,
                  content.patientGender
                )}</Text>
                <FontInfo>
                  <FontName>Courier New</FontName>
                  <FontSize>7</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.039999966</X>
              <Y>0.56747895</Y>
            </DYMOPoint>
            <Size>
              <Width>2.1700017</Width>
              <Height>0.13794978</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>Visit date</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Left</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>None</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>None</FitMode>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>Visit date: ${getVisitDateForLabelDisplay(content.visitDate, content.visitTimeZone)}</Text>
                <FontInfo>
                  <FontName>Courier New</FontName>
                  <FontSize>7</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>0.039999966</X>
              <Y>0.7054287</Y>
            </DYMOPoint>
            <Size>
              <Width>2.1700017</Width>
              <Height>0.125</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
      </LabelObjects>
    </DynamicLayoutManager>
  </DYMOLabel>
  <LabelApplication>Blank</LabelApplication>
  <DataTable>
    <Columns></Columns>
    <Rows></Rows>
  </DataTable>
</DesktopLabel>
  `;
};
