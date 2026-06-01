import { Device } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  LABEL_PRINTING_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM,
  LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM,
  LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP,
  MISSING_REQUEST_BODY,
} from 'utils';
import { describe, expect, test } from 'vitest';
import { parsePrintingConfig } from '../src/ehr/label-printing-config/get-label-printing-config';
import { validateRequestParameters } from '../src/ehr/label-printing-config/get-label-printing-config/validateRequestParameters';
import type { ZambdaInput } from '../src/shared/types/common';

// ---------- Device fixture builders ----------

const makeProperty = (
  propertyCode: string,
  valueSystem: string,
  valueCode: string
): NonNullable<Device['property']>[number] => ({
  type: {
    coding: [{ system: LABEL_PRINTING_DEVICE_PROPERTIES_SYSTEM, code: propertyCode }],
  },
  valueCode: [{ coding: [{ system: valueSystem, code: valueCode }] }],
});

const makePrintingModeProperty = (mode: string): NonNullable<Device['property']>[number] =>
  makeProperty('printing-mode', LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['printing-mode'], mode);

const makeLabelTypeProperty = (labelType: string): NonNullable<Device['property']>[number] =>
  makeProperty('label-type', LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['label-type'], labelType);

const makeLabelOrientationProperty = (orientation: string): NonNullable<Device['property']>[number] =>
  makeProperty(
    'label-orientation',
    LABEL_PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP['label-orientation'],
    orientation
  );

const makeOpenPdfExtension = (value: boolean): NonNullable<Device['extension']>[number] => ({
  url: LABEL_PRINTING_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM,
  valueBoolean: value,
});

const baseIntegratedDevice = (): Device => ({
  resourceType: 'Device',
  id: 'test-device-id',
  manufacturer: 'DYMO',
  property: [
    makePrintingModeProperty('integrated'),
    makeLabelTypeProperty('30334'),
    makeLabelOrientationProperty('portrait'),
  ],
  extension: [makeOpenPdfExtension(true)],
});

// ---------- tests ----------

describe('parsePrintingConfig', () => {
  // manual mode
  describe('manual mode', () => {
    test('returns manual config when printing-mode is manual', () => {
      const device: Device = {
        resourceType: 'Device',
        id: 'manual-device',
        property: [makePrintingModeProperty('manual')],
      };
      expect(parsePrintingConfig(device)).toEqual({ mode: 'manual' });
    });
  });

  // integrated mode - happy path
  describe('integrated mode - valid config', () => {
    test('parses full valid integrated config from the example Device', () => {
      const device: Device = {
        resourceType: 'Device',
        id: '32ad8bbc-c57c-4400-8725-ebed6bddf192',
        manufacturer: 'DYMO',
        property: [
          makePrintingModeProperty('integrated'),
          makeLabelTypeProperty('30334'),
          makeLabelOrientationProperty('portrait'),
        ],
        extension: [makeOpenPdfExtension(true)],
      };

      expect(parsePrintingConfig(device)).toEqual({
        mode: 'integrated',
        openPdfOnPrint: true,
        printerAndLabelConfig: {
          printerManufacturer: 'DYMO',
          labelType: '30334',
          orientation: 'portrait',
        },
      });
    });

    test('parses landscape orientation', () => {
      const device = baseIntegratedDevice();
      device.property = [
        makePrintingModeProperty('integrated'),
        makeLabelTypeProperty('30334'),
        makeLabelOrientationProperty('landscape'),
      ];
      const result = parsePrintingConfig(device);
      expect(result).toMatchObject({ mode: 'integrated' });
      if (result.mode === 'integrated') {
        expect(result.printerAndLabelConfig.orientation).toBe('landscape');
      }
    });

    test('openPdfOnPrint is false when extension is false', () => {
      const device = baseIntegratedDevice();
      device.extension = [makeOpenPdfExtension(false)];
      const result = parsePrintingConfig(device);
      if (result.mode === 'integrated') {
        expect(result.openPdfOnPrint).toBe(false);
      }
    });

    test('openPdfOnPrint defaults to true when extension is missing', () => {
      const device = baseIntegratedDevice();
      device.extension = undefined;
      const result = parsePrintingConfig(device);
      if (result.mode === 'integrated') {
        expect(result.openPdfOnPrint).toBe(true);
      }
    });
  });

  // orientation fallback
  describe('orientation fallback', () => {
    test('throws when orientation property is missing entirely', () => {
      const device = baseIntegratedDevice();
      device.property = [makePrintingModeProperty('integrated'), makeLabelTypeProperty('30334')];
      expect(() => parsePrintingConfig(device)).toThrow('Cannot parse property label-orientation');
    });

    test('falls back to manufacturer default orientation when orientation value is unrecognized', () => {
      const device = baseIntegratedDevice();
      device.property = [
        makePrintingModeProperty('integrated'),
        makeLabelTypeProperty('30334'),
        makeLabelOrientationProperty('diagonal'),
      ];
      const result = parsePrintingConfig(device);
      if (result.mode === 'integrated') {
        expect(result.printerAndLabelConfig.orientation).toBe('portrait');
      }
    });
  });

  // error cases
  describe('error cases', () => {
    test('throws when device has no properties', () => {
      const device: Device = { resourceType: 'Device', id: 'no-props-device' };
      expect(() => parsePrintingConfig(device)).toThrow('has no properties');
    });

    test('throws when device has an empty properties array', () => {
      const device: Device = { resourceType: 'Device', id: 'empty-props-device', property: [] };
      expect(() => parsePrintingConfig(device)).toThrow('has no properties');
    });

    test('throws when printing-mode property is missing', () => {
      const device: Device = {
        resourceType: 'Device',
        id: 'no-mode-device',
        property: [makeLabelTypeProperty('30334')],
      };
      expect(() => parsePrintingConfig(device)).toThrow('Cannot parse property printing-mode');
    });

    test('throws when printing-mode value is unrecognized', () => {
      const device: Device = {
        resourceType: 'Device',
        id: 'bad-mode-device',
        property: [makePrintingModeProperty('wireless')],
      };
      expect(() => parsePrintingConfig(device)).toThrow('unrecognized printing mode');
    });

    test('throws when integrated mode device has no manufacturer', () => {
      const device = baseIntegratedDevice();
      device.manufacturer = undefined;
      expect(() => parsePrintingConfig(device)).toThrow('Missing manufacturer');
    });

    test('throws when manufacturer is not in the supported list', () => {
      const device = baseIntegratedDevice();
      device.manufacturer = 'Zebra';
      expect(() => parsePrintingConfig(device)).toThrow('Unsupported manufacturer');
    });

    test('throws when label-type property is missing', () => {
      const device = baseIntegratedDevice();
      device.property = [makePrintingModeProperty('integrated'), makeLabelOrientationProperty('portrait')];
      expect(() => parsePrintingConfig(device)).toThrow('Cannot parse property label-type');
    });

    test('throws when label type is incompatible with the manufacturer', () => {
      const device = baseIntegratedDevice();
      device.property = [
        makePrintingModeProperty('integrated'),
        makeLabelTypeProperty('99999'),
        makeLabelOrientationProperty('portrait'),
      ];
      expect(() => parsePrintingConfig(device)).toThrow('label type incompatible with DYMO');
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

describe('validateRequestParameters (get-label-printing-config)', () => {
  test('returns deviceId and userToken for valid input with deviceId', () => {
    const result = validateRequestParameters(makeValidateInput({ deviceId: 'device-123' }));
    expect(result).toMatchObject({ deviceId: 'device-123', userToken: 'test-token', secrets: null });
  });

  test('returns undefined deviceId when deviceId is omitted from body', () => {
    const result = validateRequestParameters(makeValidateInput({}));
    expect(result.deviceId).toBeUndefined();
    expect(result.userToken).toBe('test-token');
  });

  test('strips the Bearer prefix from the Authorization header', () => {
    const result = validateRequestParameters(makeValidateInput({}, { authorization: 'Bearer abc-123' }));
    expect(result.userToken).toBe('abc-123');
  });

  test('passes secrets through to the return value', () => {
    const secrets = { ENVIRONMENT: 'test' };
    const result = validateRequestParameters(makeValidateInput({}, { secrets }));
    expect(result.secrets).toEqual(secrets);
  });

  test('throws MISSING_REQUEST_BODY when body is null', () => {
    const caught = catchThrown(() => validateRequestParameters(makeValidateInput(null)));
    expect(caught).toEqual(MISSING_REQUEST_BODY);
  });

  test('throws INVALID_INPUT_ERROR when body is not valid JSON', () => {
    const input: ZambdaInput = {
      headers: { Authorization: 'Bearer token' },
      body: '{ not valid json',
      secrets: null,
    };
    const caught = catchThrown(() => validateRequestParameters(input));
    expect(caught).toMatchObject(INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.'));
  });

  test('throws INVALID_INPUT_ERROR when deviceId is not a string', () => {
    const caught = catchThrown(() => validateRequestParameters(makeValidateInput({ deviceId: 42 })));
    expect(caught).toMatchObject({ message: expect.stringContaining('Validation failed') });
  });
});
