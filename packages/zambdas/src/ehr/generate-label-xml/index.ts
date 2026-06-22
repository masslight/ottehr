import { APIGatewayProxyResult } from 'aws-lambda';
import {
  ExternalLabsLabelConfig,
  ExternalLabsLabelContent,
  isValidUUID,
  LabelPrintingConfig,
  MANUFACTURER_TO_LABEL_MAPPING,
  SupportedPrinterManufacturer,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { VisitLabelConfig, VisitLabelContent } from '../../shared/pdf/visit-label-pdf';
import { getPrintingConfigAndDevice } from '../label-printing-config/get-label-printing-config';
import { getExternalLabLabelConfig, getVisitLabelConfig } from '../shared/label-printing';
import { validateRequestParameters } from './validateRequestParameters';
import {
  createXmlExternalLabLabel_30334_LongId,
  createXmlExternalLabLabel_30334_ShortId,
} from './xml-templates/external-lab-label-templates';
import {
  createXmlVisitLabel_30334_LongId,
  createXmlVisitLabel_30334_ShortId,
} from './xml-templates/visit-label-templates';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'generate-label-xml';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  console.log('Validating input');
  const validatedRequestParams = validateRequestParameters(input);
  const { type, secrets } = validatedRequestParams;

  console.log('Getting token');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  console.log('token', m2mToken);

  const oystehr = createOystehrClient(m2mToken, secrets);

  const getLabelConfig = async (): Promise<VisitLabelConfig | ExternalLabsLabelConfig> => {
    if (type === 'visit') {
      const { encounterId } = validatedRequestParams;
      return getVisitLabelConfig(oystehr, encounterId);
    } else {
      const { serviceRequestId, userTimezone } = validatedRequestParams;
      return getExternalLabLabelConfig(oystehr, serviceRequestId, userTimezone);
    }
  };

  const [printingConfigAndDevice, labelConfig] = await Promise.all([
    getPrintingConfigAndDevice(oystehr),
    getLabelConfig(),
  ]);

  const { printingConfig } = printingConfigAndDevice;
  if (printingConfig.mode === 'manual') {
    console.log('Printing config was manual, returning empty xml string');
    return { statusCode: 200, body: JSON.stringify({ printingConfig, labelXmlString: '' }) };
  }

  console.log(
    `printing config was integrated mode, determining label xml based on config. we are making a label of type: ${labelConfig.type}`,
    JSON.stringify(printingConfig)
  );

  // for the moment we will dictate length based on whether it is a uuid or not. But note that if friendly ids become too long, this
  // will also be a problem and these labels will truncate the id. Less a problem for in house/visit labels but an issue for external
  const patientIdForLabel = labelConfig.content.patientId;
  const idLengthType: PatientIdLengthType = isValidUUID(patientIdForLabel) ? 'longId' : 'shortId';
  console.log(`patient id length type for label xml is: `, JSON.stringify(idLengthType));

  // grab the function to spit out the xml taking care to discriminate,
  const labelXmlStringOriginalOrientation =
    labelConfig.type === 'visit'
      ? getContentToXmlFunction('visit', printingConfig)[idLengthType](labelConfig.content)
      : getContentToXmlFunction('external-lab', printingConfig)[idLengthType](labelConfig.content);

  // and update the orientation according to the config. This may update it to something other than the default from the template
  const labelXmlString = updateLabelOrientation(
    labelXmlStringOriginalOrientation,
    printingConfig.printerAndLabelConfig.orientation
  );

  return { statusCode: 200, body: JSON.stringify({ printingConfig, labelXmlString }) };
});

// the XML functions differ based on the length of the id -- short ids appear on the same line. long ids are on the next line
type PatientIdLengthType = 'shortId' | 'longId';
type LabelFunctionByPatientIdLengthType<TContent> = {
  [LEN in PatientIdLengthType]: (content: TContent) => string;
};

// if we are ever adding new label types or manufacturers, need to update SupportedPrinterManufacturer
type LabelFunctionMap<TContent> = {
  [M in SupportedPrinterManufacturer]: {
    [L in keyof (typeof MANUFACTURER_TO_LABEL_MAPPING)[M]['labelTypes']]: LabelFunctionByPatientIdLengthType<TContent>;
  };
};

const VISIT_LABEL_FUNCTION_MAP: LabelFunctionMap<VisitLabelContent> = {
  DYMO: { '30334': { longId: createXmlVisitLabel_30334_LongId, shortId: createXmlVisitLabel_30334_ShortId } },
};

const EXTERNAL_LAB_LABEL_FUNCTION_MAP: LabelFunctionMap<ExternalLabsLabelContent> = {
  DYMO: {
    '30334': { longId: createXmlExternalLabLabel_30334_LongId, shortId: createXmlExternalLabLabel_30334_ShortId },
  },
};

type LabelUse = 'visit' | 'external-lab';
function getContentToXmlFunction(
  labelUse: 'visit',
  printingConfig: LabelPrintingConfig
): LabelFunctionByPatientIdLengthType<VisitLabelContent>;
function getContentToXmlFunction(
  labelUse: 'external-lab',
  printingConfig: LabelPrintingConfig
): LabelFunctionByPatientIdLengthType<ExternalLabsLabelContent>;
function getContentToXmlFunction(
  labelUse: LabelUse,
  printingConfig: LabelPrintingConfig
): LabelFunctionByPatientIdLengthType<any> {
  if (printingConfig.mode === 'manual') return { longId: () => '', shortId: () => '' };
  const { printerManufacturer: manufacturer, labelType } = printingConfig.printerAndLabelConfig;
  if (labelUse === 'visit') {
    return VISIT_LABEL_FUNCTION_MAP[manufacturer][labelType];
  } else {
    return EXTERNAL_LAB_LABEL_FUNCTION_MAP[manufacturer][labelType];
  }
}

const updateLabelOrientation = (xmlString: string, newOrientation: string): string => {
  const orientationRegex = /<Orientation>(Portrait|Landscape)<\/Orientation>/;
  const finalOrientation = newOrientation[0].toUpperCase() + newOrientation.slice(1);
  console.log('Updating label orientation to ', finalOrientation);

  return xmlString.replace(orientationRegex, `<Orientation>${finalOrientation}</Orientation>`);
};
