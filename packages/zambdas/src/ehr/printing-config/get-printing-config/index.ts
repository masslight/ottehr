import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Device } from 'fhir/r4b';
import {
  GetPrintingConfigInput,
  getSecret,
  LabelOrientationSchema,
  MANUFACTURER_TO_LABEL_MAPPING,
  PRINTIN_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM,
  PRINTING_CONFIG_DEVICE_TAG,
  PRINTING_DEVICE_PROPERTIES_SYSTEM,
  PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP,
  PrintingConfig,
  PrintingProperty,
  PrintModeSchema,
  Secrets,
  SecretsKeys,
  SupportedPrinterManufacturerSchema,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  sendErrors,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-printing-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);

  const validatedParameters: GetPrintingConfigInput & { secrets: Secrets | null; userToken: string } =
    validateRequestParameters(input);

  const { secrets, deviceId } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  try {
    const { printingConfig, device } = await getPrintingConfigAndDevice(oystehr, deviceId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        deviceId: device?.id,
        config: printingConfig,
      }),
    };
  } catch (e) {
    console.warn(`Hit an error when trying to parse the config on Device/${deviceId}. Returning manual mode`, e);
    await sendErrors(e, getSecret(SecretsKeys.ENVIRONMENT, secrets));
    return {
      statusCode: 200,
      body: JSON.stringify(MANUAL_MODE_RESPONSE),
    };
  }
});

/**
 * Parses the printing config for the default intsnace level Device, or the Device id if provided.
 * Returns a manual config if no matching device is found. Throws if an error is encountered.
 *
 * Future todo: consider grabbing printing devices by location
 * @param oystehr
 * @param deviceId
 * @returns
 */
export const getPrintingConfigAndDevice = async (
  oystehr: Oystehr,
  deviceId?: string
): Promise<{ printingConfig: PrintingConfig; device: Device | undefined }> => {
  const searchParams: SearchParam[] = [
    {
      name: '_tag',
      value: `${PRINTING_CONFIG_DEVICE_TAG.system}|${PRINTING_CONFIG_DEVICE_TAG.code}`,
    },
  ];

  if (deviceId) searchParams.push({ name: '_id', value: deviceId });

  console.log('get-printing-config search params is', JSON.stringify(searchParams));

  const deviceResponse = (
    await oystehr.fhir.search<Device>({
      resourceType: 'Device',
      params: searchParams,
    })
  ).unbundle();

  const device = deviceResponse.find((res): res is Device => res.resourceType === 'Device');

  if (!device) {
    console.warn(
      `No device with the device tag and/or the matching deviceId ${deviceId} was found. Returning manual config`
    );
    return { printingConfig: MANUAL_MODE_RESPONSE, device: undefined };
  }

  console.log(`Found printing config Device/${device.id}`);
  const parsedConfig = parsePrintingConfig(device);
  return { printingConfig: parsedConfig, device };
};

const parsePrintingConfig = (device: Device): PrintingConfig => {
  console.log(`Parsing printing config from Device/${device.id}`);

  // determine the printing mode
  const properties = device.property;
  if (!properties?.length) {
    throw new Error(`Device/${device.id} has no properties, cannot parse printing config.`);
  }

  const mode = extractValueCodeProperty(properties, {
    propertyName: 'printing-mode',
    valueSystem: PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['printing-mode'],
  });

  // todo: validate printing mode
  const modeResult = PrintModeSchema.safeParse(mode);
  if (!modeResult) {
    throw new Error(`Device/${device.id} contained unrecognized printing mode: ${mode}`);
  }
  const validatedMode = modeResult.data!;

  if (validatedMode === 'manual') {
    console.log('detected manual mode config');
    return MANUAL_MODE_RESPONSE;
  }

  console.log('detected integrated mode config');

  const manufacturer = device.manufacturer;
  if (!manufacturer) {
    console.warn(`Device/${device.id} has no manufacturer, unable to validate label type vs manufacturer`);
  }

  // make sure it's a supported manufacturer and label type combo
  const manufacturerResult = SupportedPrinterManufacturerSchema.safeParse(manufacturer);
  if (!manufacturerResult.success) {
    throw new Error(`Unsupported manufacturer: ${manufacturer}`);
  }

  // typed as SupportedPrinterManufacturer
  const validatedManufacturer = manufacturerResult.data;

  const labelType = extractValueCodeProperty(properties, {
    propertyName: 'label-type',
    valueSystem: PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['label-type'],
  });

  const labelTypeResult = MANUFACTURER_TO_LABEL_MAPPING[validatedManufacturer].labelTypeSchema.safeParse(labelType);
  if (!labelTypeResult.success) {
    throw new Error(
      `Device/${device.id} contained a label type incompatible with ${validatedManufacturer}: ${labelType}`
    );
  }
  const validatedLabelType = labelTypeResult.data;

  const orientation = extractValueCodeProperty(properties, {
    propertyName: 'label-orientation',
    valueSystem: PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['label-orientation'],
  });

  const orientationResult = LabelOrientationSchema.safeParse(orientation);
  let validatedOrientation = orientationResult.data;
  if (!orientationResult.success) {
    const defaultOrientation =
      MANUFACTURER_TO_LABEL_MAPPING[validatedManufacturer].labelTypes[validatedLabelType].defaultOrientation;
    console.warn(
      `Device/${device.id} contained an unrecognized orientation. Defaulting to default for labelType: ${defaultOrientation}`
    );
    validatedOrientation = defaultOrientation;
  }
  if (!validatedOrientation) {
    // this is just to make types happy
    throw new Error('Default orientation fallback has failed, orientation was undefined');
  }

  const printingConfig: PrintingConfig = {
    mode: validatedMode,
    openPdfOnPrint: extractOpenPdfOnPrintBool(device),
    printerAndLabelConfig: {
      printerManufacturer: validatedManufacturer,
      labelType: validatedLabelType,
      orientation: validatedOrientation,
    },
  };

  console.log('Parsed printing config: ', JSON.stringify(printingConfig));
  return printingConfig;
};

const MANUAL_MODE_RESPONSE: PrintingConfig = { mode: 'manual' };

const extractValueCodeProperty = (
  properties: Device['property'],
  propertyDetails: { propertyName: PrintingProperty; valueSystem: string }
): string => {
  const property = properties?.find(
    (property) =>
      property.type.coding?.some(
        (coding) => coding.system === PRINTING_DEVICE_PROPERTIES_SYSTEM && coding.code === propertyDetails.propertyName
      )
  );
  if (!property) {
    throw new Error(`Cannot parse property ${propertyDetails.propertyName}`);
  }

  const propertyValue = property.valueCode?.[0].coding?.find((coding) => coding.system === propertyDetails.valueSystem)
    ?.code;
  if (!propertyValue) {
    throw new Error(
      `Could not parse value for property ${propertyDetails.propertyName} at ${propertyDetails.valueSystem}`
    );
  }

  return propertyValue;
};

const extractOpenPdfOnPrintBool = (device: Device): boolean => {
  // if the extension isn't there, we'll open it to be conservative
  return (
    device.extension?.find(
      (ext) => ext.url === PRINTIN_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM && ext.valueBoolean !== undefined
    )?.valueBoolean ?? true
  );
};
