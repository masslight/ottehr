import { Communication } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';

/**
 * Tests for the helper functions used in handle-inbound-fax/index.ts.
 * Since these are module-private functions, we replicate them here to validate the logic.
 */

const FAX_PAGES_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/fax-pages';

function getSenderFaxNumber(communication: Communication): string {
  const senderRef = communication.sender?.reference;
  if (senderRef?.startsWith('#')) {
    return senderRef.replace('#', '');
  }
  return senderRef ?? 'unknown';
}

function getPageCount(communication: Communication): number | undefined {
  const ext = communication.extension?.find((e) => e.url === FAX_PAGES_EXTENSION_URL);
  return ext?.valueInteger;
}

function getPdfUrl(communication: Communication): string | undefined {
  return communication.payload?.[0]?.contentAttachment?.url;
}

// ============================================================================
// getSenderFaxNumber
// ============================================================================

describe('getSenderFaxNumber', () => {
  test('should extract phone number from contained reference', () => {
    const comm: Communication = {
      resourceType: 'Communication',
      status: 'completed',
      sender: { reference: '#+15551234567' },
    };
    expect(getSenderFaxNumber(comm)).toBe('+15551234567');
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
