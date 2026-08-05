import { Communication } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';
import {
  getPageCount,
  getPdfUrl,
  getSenderFaxNumber,
} from '../../src/subscriptions/communication/handle-inbound-fax/index';

const FAX_PAGES_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/fax-pages';

// ============================================================================
// getSenderFaxNumber
// ============================================================================

describe('getSenderFaxNumber', () => {
  test('should extract phone number from contained Device identifier', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      sender: { reference: '#fax-device' },
      contained: [
        {
          resourceType: 'Device',
          id: 'fax-device',
          identifier: [{ system: 'phone', value: '+15551234567' }],
        },
      ],
    };
    expect(getSenderFaxNumber(comm)).toBe('+15551234567');
  });

  test('should fall back to contained ID when Device has no identifier', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      sender: { reference: '#some-device-id' },
      contained: [
        {
          resourceType: 'Device',
          id: 'some-device-id',
        },
      ],
    };
    expect(getSenderFaxNumber(comm)).toBe('some-device-id');
  });

  test('should fall back to contained ID when no matching contained resource', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      sender: { reference: '#+15559999999' },
    };
    expect(getSenderFaxNumber(comm)).toBe('+15559999999');
  });

  test('should return direct reference when not a hash reference', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      sender: { reference: 'Device/device-123' },
    };
    expect(getSenderFaxNumber(comm)).toBe('Device/device-123');
  });

  test('should return "unknown" when sender is undefined', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
    };
    expect(getSenderFaxNumber(comm)).toBe('unknown');
  });

  test('should return "unknown" when sender reference is undefined', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      sender: {},
    };
    expect(getSenderFaxNumber(comm)).toBe('unknown');
  });
});

// ============================================================================
// getPageCount
// ============================================================================

describe('getPageCount', () => {
  test('should extract page count from extension', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      extension: [{ url: FAX_PAGES_EXTENSION_URL, valueInteger: 5 }],
    };
    expect(getPageCount(comm)).toBe(5);
  });

  test('should return undefined when extension is missing', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
    };
    expect(getPageCount(comm)).toBeUndefined();
  });

  test('should return undefined when fax-pages extension is not present', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      extension: [{ url: 'https://other.extension.com/something', valueInteger: 10 }],
    };
    expect(getPageCount(comm)).toBeUndefined();
  });
});

// ============================================================================
// getPdfUrl
// ============================================================================

describe('getPdfUrl', () => {
  test('should extract PDF URL from payload', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      payload: [{ contentAttachment: { url: 'https://z3.example.com/bucket/fax.pdf' } }],
    };
    expect(getPdfUrl(comm)).toBe('https://z3.example.com/bucket/fax.pdf');
  });

  test('should return undefined when payload is missing', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
    };
    expect(getPdfUrl(comm)).toBeUndefined();
  });

  test('should return undefined when payload has no contentAttachment', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      payload: [{ contentString: 'text message' }],
    };
    expect(getPdfUrl(comm)).toBeUndefined();
  });

  test('should return undefined when payload is empty array', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      payload: [],
    };
    expect(getPdfUrl(comm)).toBeUndefined();
  });
});
