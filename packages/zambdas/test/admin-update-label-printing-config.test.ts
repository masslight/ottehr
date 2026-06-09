import { DeviceProperty } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  LABEL_PRINTING_CONFIG_DEVICE_TAG,
  LABEL_PRINTING_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM,
  LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM,
  LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP,
  LabelPrintingConfig,
  MISSING_REQUEST_BODY,
} from 'utils';
import { describe, expect, test } from 'vitest';
import { convertPrintingConfigToDevice } from '../src/ehr/label-printing-config/admin-update-label-printing-config';
import { validateRequestParameters } from '../src/ehr/label-printing-config/admin-update-label-printing-config/validateRequestParameters';
import { parsePrintingConfig } from '../src/ehr/label-printing-config/get-label-printing-config';
import type { ZambdaInput } from '../src/shared/types/common';

// ---------- helpers ----------

const findProperty = (
  device: ReturnType<typeof convertPrintingConfigToDevice>,
  propertyCode: string
): DeviceProperty | undefined => device.property?.find((p) => p.type.coding?.some((c) => c.code === propertyCode));

const getPropertyValue = (
  device: ReturnType<typeof convertPrintingConfigToDevice>,
  propertyCode: string
): string | undefined => {
  const prop = findProperty(device, propertyCode);
  return prop?.valueCode?.[0]?.coding?.[0]?.code;
};

// ---------- tests ----------

describe('convertPrintingConfigToDevice', () => {
  describe('shared structure', () => {
    test('always sets resourceType to Device', () => {
      const device = convertPrintingConfigToDevice({ mode: 'manual' });
      expect(device.resourceType).toBe('Device');
    });

    test('always tags the device with the label-printing-config tag', () => {
      const device = convertPrintingConfigToDevice({ mode: 'manual' });
      expect(device.meta?.tag).toContainEqual(LABEL_PRINTING_CONFIG_DEVICE_TAG);
    });

    test('does not set an id (id is assigned by the caller when updating)', () => {
      const device = convertPrintingConfigToDevice({ mode: 'manual' });
      expect(device.id).toBeUndefined();
    });
  });

  describe('manual mode', () => {
    const manualConfig: LabelPrintingConfig = { mode: 'manual' };

    test('produces exactly one property for printing-mode', () => {
      const device = convertPrintingConfigToDevice(manualConfig);
      expect(device.property).toHaveLength(1);
    });

    test('printing-mode property has the correct type system and code', () => {
      const device = convertPrintingConfigToDevice(manualConfig);
      const prop = device.property?.[0];
      expect(prop?.type.coding?.[0]).toMatchObject({
        system: LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM,
        code: 'printing-mode',
      });
    });

    test('printing-mode property value is manual', () => {
      const device = convertPrintingConfigToDevice(manualConfig);
      expect(getPropertyValue(device, 'printing-mode')).toBe('manual');
    });

    test('printing-mode value uses the correct value system', () => {
      const device = convertPrintingConfigToDevice(manualConfig);
      const prop = findProperty(device, 'printing-mode');
      expect(prop?.valueCode?.[0]?.coding?.[0]?.system).toBe(
        LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['printing-mode']
      );
    });

    test('does not set manufacturer', () => {
      const device = convertPrintingConfigToDevice(manualConfig);
      expect(device.manufacturer).toBeUndefined();
    });

    test('does not set extension', () => {
      const device = convertPrintingConfigToDevice(manualConfig);
      expect(device.extension).toBeUndefined();
    });
  });

  describe('integrated mode', () => {
    const integratedConfig: LabelPrintingConfig = {
      mode: 'integrated',
      openPdfOnPrint: true,
      printerAndLabelConfig: {
        printerManufacturer: 'DYMO',
        labelType: '30334',
        orientation: 'portrait',
      },
    };

    test('produces exactly three properties', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      expect(device.property).toHaveLength(3);
    });

    test('printing-mode property value is integrated', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      expect(getPropertyValue(device, 'printing-mode')).toBe('integrated');
    });

    test('label-type property value matches config', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      expect(getPropertyValue(device, 'label-type')).toBe('30334');
    });

    test('label-orientation property value matches config', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      expect(getPropertyValue(device, 'label-orientation')).toBe('portrait');
    });

    test('label-orientation landscape is preserved', () => {
      const config: LabelPrintingConfig = {
        ...integratedConfig,
        printerAndLabelConfig: { ...integratedConfig.printerAndLabelConfig, orientation: 'landscape' },
      };
      const device = convertPrintingConfigToDevice(config);
      expect(getPropertyValue(device, 'label-orientation')).toBe('landscape');
    });

    test('sets manufacturer from printerAndLabelConfig', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      expect(device.manufacturer).toBe('DYMO');
    });

    test('sets the openPdfOnPrint extension with valueBoolean true', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      const ext = device.extension?.find((e) => e.url === LABEL_PRINTING_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM);
      expect(ext?.valueBoolean).toBe(true);
    });

    test('sets the openPdfOnPrint extension with valueBoolean false', () => {
      const config: LabelPrintingConfig = { ...integratedConfig, openPdfOnPrint: false };
      const device = convertPrintingConfigToDevice(config);
      const ext = device.extension?.find((e) => e.url === LABEL_PRINTING_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM);
      expect(ext?.valueBoolean).toBe(false);
    });

    test('each property type coding uses the shared print-config-properties system', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      for (const prop of device.property ?? []) {
        expect(prop.type.coding?.[0]?.system).toBe(LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM);
      }
    });

    test('each property value coding uses its own specific value system', () => {
      const device = convertPrintingConfigToDevice(integratedConfig);
      const propertyNames = ['printing-mode', 'label-type', 'label-orientation'] as const;
      for (const name of propertyNames) {
        const prop = findProperty(device, name);
        expect(prop?.valueCode?.[0]?.coding?.[0]?.system).toBe(LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP[name]);
      }
    });
  });

  describe('roundtrip with parsePrintingConfig', () => {
    test('manual config survives a convert → parse roundtrip', () => {
      const original: LabelPrintingConfig = { mode: 'manual' };
      const device = { ...convertPrintingConfigToDevice(original), id: 'roundtrip-device' };
      expect(parsePrintingConfig(device)).toEqual(original);
    });

    test('integrated config survives a convert → parse roundtrip', () => {
      const original: LabelPrintingConfig = {
        mode: 'integrated',
        openPdfOnPrint: false,
        printerAndLabelConfig: {
          printerManufacturer: 'DYMO',
          labelType: '30334',
          orientation: 'landscape',
        },
      };
      const device = { ...convertPrintingConfigToDevice(original), id: 'roundtrip-device' };
      expect(parsePrintingConfig(device)).toEqual(original);
    });
  });
});

// ---------- validateRequestParameters ----------

const catchThrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
};

const makeValidateInput = (
  body: Record<string, unknown> | null,
  options: { authorization?: string; secrets?: ZambdaInput['secrets'] } = {}
): ZambdaInput => ({
  headers: { Authorization: options.authorization ?? 'Bearer test-token' },
  body: body === null ? null : JSON.stringify(body),
  secrets: options.secrets ?? null,
});

const manualConfigBody = { config: { mode: 'manual' } };
const integratedConfigBody = {
  config: {
    mode: 'integrated',
    openPdfOnPrint: true,
    printerAndLabelConfig: { printerManufacturer: 'DYMO', labelType: '30334', orientation: 'portrait' },
  },
};

describe('validateRequestParameters (admin-update-label-printing-config)', () => {
  describe('valid inputs', () => {
    test('returns config, userToken, and secrets for a valid manual config without deviceId', () => {
      const result = validateRequestParameters(makeValidateInput(manualConfigBody));
      expect(result).toMatchObject({ config: { mode: 'manual' }, userToken: 'test-token', secrets: null });
      expect(result.deviceId).toBeUndefined();
    });

    test('returns config and deviceId for a valid integrated config with deviceId', () => {
      const result = validateRequestParameters(makeValidateInput({ ...integratedConfigBody, deviceId: 'device-abc' }));
      expect(result.deviceId).toBe('device-abc');
      expect(result.config).toMatchObject({ mode: 'integrated' });
    });

    test('strips Bearer prefix from the Authorization header', () => {
      const result = validateRequestParameters(
        makeValidateInput(manualConfigBody, { authorization: 'Bearer xyz-456' })
      );
      expect(result.userToken).toBe('xyz-456');
    });

    test('passes secrets through to the return value', () => {
      const secrets = { ENVIRONMENT: 'test' };
      const result = validateRequestParameters(makeValidateInput(manualConfigBody, { secrets }));
      expect(result.secrets).toEqual(secrets);
    });

    test('validates and returns a full integrated config correctly', () => {
      const result = validateRequestParameters(makeValidateInput(integratedConfigBody));
      expect(result.config).toEqual({
        mode: 'integrated',
        openPdfOnPrint: true,
        printerAndLabelConfig: { printerManufacturer: 'DYMO', labelType: '30334', orientation: 'portrait' },
      });
    });

    test('accepts an integrated config with openPdfOnPrint false', () => {
      const body = { config: { ...integratedConfigBody.config, openPdfOnPrint: false } };
      const result = validateRequestParameters(makeValidateInput(body));
      if (result.config.mode === 'integrated') {
        expect(result.config.openPdfOnPrint).toBe(false);
      }
    });
  });

  describe('missing or malformed body', () => {
    test('throws MISSING_REQUEST_BODY when body is null', () => {
      const caught = catchThrown(() => validateRequestParameters(makeValidateInput(null)));
      expect(caught).toEqual(MISSING_REQUEST_BODY);
    });

    test('throws INVALID_INPUT_ERROR when body is not valid JSON', () => {
      const input: ZambdaInput = { headers: { Authorization: 'Bearer token' }, body: '{ bad json', secrets: null };
      const caught = catchThrown(() => validateRequestParameters(input));
      expect(caught).toMatchObject(INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.'));
    });
  });

  describe('config field validation', () => {
    test('throws INVALID_INPUT_ERROR when config is missing entirely', () => {
      const caught = catchThrown(() => validateRequestParameters(makeValidateInput({ deviceId: 'device-123' })));
      expect(caught).toMatchObject({ message: expect.stringContaining('Validation failed') });
    });

    test('throws INVALID_INPUT_ERROR when config.mode is an unrecognized value', () => {
      const caught = catchThrown(() => validateRequestParameters(makeValidateInput({ config: { mode: 'fax' } })));
      expect(caught).toMatchObject({ message: expect.stringContaining('Validation failed') });
    });

    test('throws INVALID_INPUT_ERROR when integrated config is missing printerAndLabelConfig', () => {
      const caught = catchThrown(() =>
        validateRequestParameters(makeValidateInput({ config: { mode: 'integrated', openPdfOnPrint: true } }))
      );
      expect(caught).toMatchObject({ message: expect.stringContaining('Validation failed') });
    });

    test('throws INVALID_INPUT_ERROR when integrated config is missing openPdfOnPrint', () => {
      const caught = catchThrown(() =>
        validateRequestParameters(
          makeValidateInput({
            config: {
              mode: 'integrated',
              printerAndLabelConfig: { printerManufacturer: 'DYMO', labelType: '30334', orientation: 'portrait' },
            },
          })
        )
      );
      expect(caught).toMatchObject({ message: expect.stringContaining('Validation failed') });
    });

    test('throws INVALID_INPUT_ERROR when label type is invalid for the given manufacturer', () => {
      const caught = catchThrown(() =>
        validateRequestParameters(
          makeValidateInput({
            config: {
              mode: 'integrated',
              openPdfOnPrint: true,
              printerAndLabelConfig: { printerManufacturer: 'DYMO', labelType: '99999', orientation: 'portrait' },
            },
          })
        )
      );
      expect(caught).toMatchObject({ message: expect.stringContaining('Validation failed') });
    });

    test('throws INVALID_INPUT_ERROR when deviceId is not a string', () => {
      const caught = catchThrown(() =>
        validateRequestParameters(makeValidateInput({ ...manualConfigBody, deviceId: 42 }))
      );
      expect(caught).toMatchObject({ message: expect.stringContaining('Validation failed') });
    });
  });
});
