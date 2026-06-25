import { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Device, DeviceProperty } from 'fhir/r4b';
import {
  AdminUpdatePrintingConfigInput,
  LABEL_PRINTING_CONFIG_DEVICE_TAG,
  LABEL_PRINTING_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM,
  LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM,
  LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP,
  LabelPrintingConfig,
  LabelPrintingProperty,
  Secrets,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-label-printing-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);

  const validatedParameters: AdminUpdatePrintingConfigInput & { secrets: Secrets | null; userToken: string } =
    validateRequestParameters(input);

  const { secrets, deviceId, config } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // we'll grab the singular existing printing config if it exists, or we'll make a new one
  const searchParams: SearchParam[] = [
    {
      name: '_tag',
      value: `${LABEL_PRINTING_CONFIG_DEVICE_TAG.system}|${LABEL_PRINTING_CONFIG_DEVICE_TAG.code}`,
    },
  ];

  if (deviceId) searchParams.push({ name: '_id', value: deviceId });

  console.log('admin-update-printing-config search params is', JSON.stringify(searchParams));

  const deviceResponse = (
    await oystehr.fhir.search<Device>({
      resourceType: 'Device',
      params: searchParams,
    })
  ).unbundle();

  const existingDevice = deviceResponse.find((res): res is Device => res.resourceType === 'Device');

  if (!existingDevice) {
    console.warn(
      `No device with the device tag and/or the matching deviceId ${deviceId} was found. Will make new Device for config`
    );
  }

  console.log(`Found printing config Device/${existingDevice?.id}`);

  const parsedConfigDevice = convertPrintingConfigToDevice(config);

  // make the fhir call -- determine if we're doing a put with optimistic locking, or if we're doing a create
  if (existingDevice) {
    const updateResult = await oystehr.fhir.update<Device>(
      { ...parsedConfigDevice, id: existingDevice.id! },
      existingDevice.meta?.versionId ? { optimisticLockingVersionId: existingDevice.meta.versionId } : undefined
    );
    console.log('Update printing config device result: ', JSON.stringify(updateResult));
  } else {
    const createResult = await oystehr.fhir.create<Device>(parsedConfigDevice);
    console.log('Create printing device config result', JSON.stringify(createResult));
  }

  return {
    statusCode: 204,
    body: JSON.stringify({}),
  };
});

export const convertPrintingConfigToDevice = (config: LabelPrintingConfig): Device => {
  const properties: Device['property'] = [];

  const device: Device = {
    resourceType: 'Device',
    meta: {
      tag: [LABEL_PRINTING_CONFIG_DEVICE_TAG],
    },
  };

  const mode = config.mode;
  properties.push(
    makeProperty(config, {
      propertyName: 'printing-mode',
      valueSystem: LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['printing-mode'],
    })
  );

  if (mode === 'integrated') {
    device.manufacturer = config.printerAndLabelConfig.printerManufacturer;

    properties.push(
      makeProperty(config, {
        propertyName: 'label-type',
        valueSystem: LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['label-type'],
      }),
      makeProperty(config, {
        propertyName: 'label-orientation',
        valueSystem: LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['label-orientation'],
      })
    );

    device.extension = [
      {
        url: LABEL_PRINTING_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM,
        valueBoolean: config.openPdfOnPrint,
      },
    ];
  }

  // add all the properties to the device
  device.property = properties;

  console.log('This is the device made from the config after parsing: ', JSON.stringify(device));
  return device;
};

const makeProperty = (
  config: LabelPrintingConfig,
  propertyDetails: { propertyName: LabelPrintingProperty; valueSystem: string }
): DeviceProperty => {
  if (config.mode === 'manual') {
    return {
      type: {
        coding: [
          {
            system: LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM,
            code: 'printing-mode',
          },
        ],
      },
      valueCode: [
        {
          coding: [
            {
              system: LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['printing-mode'],
              code: 'manual',
            },
          ],
        },
      ],
    };
  }

  const propertyValue = (): any => {
    switch (propertyDetails.propertyName) {
      case 'printing-mode':
        return config.mode;
      case 'label-type':
        return config.printerAndLabelConfig.labelType;
      case 'label-orientation':
        return config.printerAndLabelConfig.orientation;
      default:
        return '';
    }
  };

  const property = {
    type: {
      coding: [
        {
          system: LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM,
          code: propertyDetails.propertyName,
        },
      ],
    },
    valueCode: [
      {
        coding: [
          {
            system: propertyDetails.valueSystem,
            code: propertyValue(),
          },
        ],
      },
    ],
  };

  return property;
};
