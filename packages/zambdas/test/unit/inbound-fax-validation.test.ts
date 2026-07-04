import { Communication } from 'fhir/r4b';
import { APIError, APIErrorCode } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters as validateDeleteParams } from '../../src/ehr/delete-inbound-fax/validateRequestParameters';
import { validateRequestParameters as validateFileParams } from '../../src/ehr/file-inbound-fax/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';
import { validateRequestParameters as validateHandleParams } from '../../src/subscriptions/communication/handle-inbound-fax/validateRequestParameters';

const createMockZambdaInput = (body: any): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: {
    Authorization: 'Bearer test-token',
  },
  secrets: null,
});

const emptyBodyInput: ZambdaInput = {
  body: '',
  headers: { Authorization: 'Bearer test-token' },
  secrets: null,
};

/** Runs fn, expecting it to throw a structured APIError; returns the thrown error. */
const catchApiError = (fn: () => unknown): APIError => {
  try {
    fn();
  } catch (error) {
    return error as APIError;
  }
  throw new Error('Expected function to throw, but it did not');
};

// ============================================================================
// file-inbound-fax validation
// ============================================================================

describe('File Inbound Fax - validateRequestParameters', () => {
  const validBody = {
    taskId: 'task-123',
    communicationId: 'comm-456',
    patientId: 'patient-789',
    folderId: 'folder-abc',
    documentName: 'Fax from +15551234567',
  };

  test('should validate input with all required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateFileParams(input);

    expect(result.taskId).toBe('task-123');
    expect(result.communicationId).toBe('comm-456');
    expect(result.patientId).toBe('patient-789');
    expect(result.folderId).toBe('folder-abc');
    expect(result.documentName).toBe('Fax from +15551234567');
    expect(result.secrets).toBeNull();
  });

  test('should throw structured error when body is missing', () => {
    const error = catchApiError(() => validateFileParams(emptyBodyInput));
    expect(error.code).toBe(APIErrorCode.MISSING_REQUEST_BODY);
  });

  test.each(['taskId', 'communicationId', 'patientId', 'folderId', 'documentName'] as const)(
    'should throw structured error when %s is missing',
    (param) => {
      const { [param]: _removed, ...rest } = validBody;
      const error = catchApiError(() => validateFileParams(createMockZambdaInput(rest)));
      expect(error.code).toBe(APIErrorCode.MISSING_REQUIRED_PARAMETERS);
      expect(error.message).toContain(param);
    }
  );

  test('should report all missing params at once', () => {
    const error = catchApiError(() => validateFileParams(createMockZambdaInput({ taskId: 'task-123' })));
    expect(error.code).toBe(APIErrorCode.MISSING_REQUIRED_PARAMETERS);
    for (const param of ['communicationId', 'patientId', 'folderId', 'documentName']) {
      expect(error.message).toContain(param);
    }
  });

  test('SECURITY: should accept but ignore a client-supplied pdfUrl (server sources it from the Task)', () => {
    const input = createMockZambdaInput({ ...validBody, pdfUrl: 'https://evil.example.com/anything.pdf' });
    const result = validateFileParams(input);
    expect(result).not.toHaveProperty('pdfUrl');
  });

  test('should not require pdfUrl', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateFileParams(input)).not.toThrow();
  });
});

// ============================================================================
// delete-inbound-fax validation
// ============================================================================

describe('Delete Inbound Fax - validateRequestParameters', () => {
  const validBody = {
    taskId: 'task-123',
    communicationId: 'comm-456',
  };

  test('should validate input with all required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateDeleteParams(input);

    expect(result.taskId).toBe('task-123');
    expect(result.communicationId).toBe('comm-456');
    expect(result.secrets).toBeNull();
  });

  test('should throw structured error when body is missing', () => {
    const error = catchApiError(() => validateDeleteParams(emptyBodyInput));
    expect(error.code).toBe(APIErrorCode.MISSING_REQUEST_BODY);
  });

  test.each(['taskId', 'communicationId'] as const)('should throw structured error when %s is missing', (param) => {
    const { [param]: _removed, ...rest } = validBody;
    const error = catchApiError(() => validateDeleteParams(createMockZambdaInput(rest)));
    expect(error.code).toBe(APIErrorCode.MISSING_REQUIRED_PARAMETERS);
    expect(error.message).toContain(param);
  });

  test('SECURITY: should accept but ignore a client-supplied pdfUrl (server sources it from the Task)', () => {
    const input = createMockZambdaInput({ ...validBody, pdfUrl: 'https://evil.example.com/anything.pdf' });
    const result = validateDeleteParams(input);
    expect(result).not.toHaveProperty('pdfUrl');
  });

  test('should not require pdfUrl', () => {
    const input = createMockZambdaInput(validBody);
    expect(() => validateDeleteParams(input)).not.toThrow();
  });
});

// ============================================================================
// handle-inbound-fax validation
// ============================================================================

describe('Handle Inbound Fax - validateRequestParameters', () => {
  const validCommunication: Communication = {
    resourceType: 'Communication',
    id: 'comm-123',
    status: 'completed',
    received: '2026-03-13T10:00:00Z',
    sender: { reference: '#fax-sender' },
    contained: [
      {
        resourceType: 'Device',
        id: 'fax-sender',
        identifier: [{ system: 'phone', value: '+15551234567' }],
      },
    ],
    payload: [{ contentAttachment: { url: 'https://z3.example.com/bucket/file.pdf' } }],
    extension: [{ url: 'https://extensions.fhir.oystehr.com/fax-pages', valueInteger: 3 }],
  };

  test('should validate a valid completed Communication', () => {
    const input = createMockZambdaInput(validCommunication);
    const result = validateHandleParams(input);

    expect(result.communication.id).toBe('comm-123');
    expect(result.communication.status).toBe('completed');
    expect(result.secrets).toBeNull();
  });

  test('should throw structured error when body is missing', () => {
    const error = catchApiError(() => validateHandleParams(emptyBodyInput));
    expect(error.code).toBe(APIErrorCode.MISSING_REQUEST_BODY);
  });

  test('should throw structured error when resourceType is not Communication', () => {
    const input = createMockZambdaInput({
      ...validCommunication,
      resourceType: 'Patient',
    });

    const error = catchApiError(() => validateHandleParams(input));
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(error.message).toBe('Expected Communication but got Patient');
  });

  test('should throw structured error when status is not completed', () => {
    const input = createMockZambdaInput({
      ...validCommunication,
      status: 'in-progress',
    });

    const error = catchApiError(() => validateHandleParams(input));
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(error.message).toBe('Expected completed status but got in-progress');
  });

  test('should throw structured error when id is missing', () => {
    const { id: _id, ...rest } = validCommunication;
    const input = createMockZambdaInput(rest);

    const error = catchApiError(() => validateHandleParams(input));
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
    expect(error.message).toBe('Communication is missing id');
  });
});
