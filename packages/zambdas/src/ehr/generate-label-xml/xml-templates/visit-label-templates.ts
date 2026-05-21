import {
  getPatientDOBAndSexForLabelDisplay,
  getPatientNameForLabelDisplay,
  getVisitDateForLabelDisplay,
  VisitLabelContent,
} from '../../../shared/pdf/visit-label-pdf';

// This is for the 30334 label. PID is on two lines for now to avoid truncating. Can change once the friendly ID is added
export const createXmlVisitLabel_30334 = (content: VisitLabelContent): string => {
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
