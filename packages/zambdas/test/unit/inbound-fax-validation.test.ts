import { Communication } from 'fhir/r4b';
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
    pdfUrl: 'https://z3.example.com/bucket/file.pdf',
  };

  test('should validate input with all required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateFileParams(input);

    expect(result.taskId).toBe('task-123');
    expect(result.communicationId).toBe('comm-456');
    expect(result.patientId).toBe('patient-789');
    expect(result.folderId).toBe('folder-abc');
    expect(result.documentName).toBe('Fax from +15551234567');
    expect(result.pdfUrl).toBe('https://z3.example.com/bucket/file.pdf');
    expect(result.secrets).toBeNull();
  });

  test('should throw error when body is missing', () => {
    const input: ZambdaInput = {
      body: '',
      headers: { Authorization: 'Bearer test-token' },
      secrets: null,
    };

    expect(() => validateFileParams(input)).toThrow('No request body provided');
  });

  test('should throw error when taskId is missing', () => {
    const { taskId: _taskId, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateFileParams(input)).toThrow('taskId is required');
  });

  test('should throw error when communicationId is missing', () => {
    const { communicationId: _communicationId, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateFileParams(input)).toThrow('communicationId is required');
  });

  test('should throw error when patientId is missing', () => {
    const { patientId: _patientId, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateFileParams(input)).toThrow('patientId is required');
  });

  test('should throw error when folderId is missing', () => {
    const { folderId: _folderId, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateFileParams(input)).toThrow('folderId is required');
  });

  test('should throw error when documentName is missing', () => {
    const { documentName: _documentName, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateFileParams(input)).toThrow('documentName is required');
  });

  test('should throw error when pdfUrl is missing', () => {
    const { pdfUrl: _pdfUrl, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateFileParams(input)).toThrow('pdfUrl is required');
  });
});

// ============================================================================
// delete-inbound-fax validation
// ============================================================================

describe('Delete Inbound Fax - validateRequestParameters', () => {
  const validBody = {
    taskId: 'task-123',
    communicationId: 'comm-456',
    pdfUrl: 'https://z3.example.com/bucket/file.pdf',
  };

  test('should validate input with all required fields', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateDeleteParams(input);

    expect(result.taskId).toBe('task-123');
    expect(result.communicationId).toBe('comm-456');
    expect(result.pdfUrl).toBe('https://z3.example.com/bucket/file.pdf');
    expect(result.secrets).toBeNull();
  });

  test('should throw error when body is missing', () => {
    const input: ZambdaInput = {
      body: '',
      headers: { Authorization: 'Bearer test-token' },
      secrets: null,
    };

    expect(() => validateDeleteParams(input)).toThrow('No request body provided');
  });

  test('should throw error when taskId is missing', () => {
    const { taskId: _taskId, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateDeleteParams(input)).toThrow('taskId is required');
  });

  test('should throw error when communicationId is missing', () => {
    const { communicationId: _communicationId, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateDeleteParams(input)).toThrow('communicationId is required');
  });

  test('should throw error when pdfUrl is missing', () => {
    const { pdfUrl: _pdfUrl, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateDeleteParams(input)).toThrow('pdfUrl is required');
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
    sender: { reference: '#+15551234567' },
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

  test('should throw error when body is missing', () => {
    const input: ZambdaInput = {
      body: '',
      headers: { Authorization: 'Bearer test-token' },
      secrets: null,
    };

    expect(() => validateHandleParams(input)).toThrow('No request body provided');
  });

  test('should throw error when resourceType is not Communication', () => {
    const input = createMockZambdaInput({
      ...validCommunication,
      resourceType: 'Patient',
    });

    expect(() => validateHandleParams(input)).toThrow('Expected Communication but got Patient');
  });

  test('should throw error when status is not completed', () => {
    const input = createMockZambdaInput({
      ...validCommunication,
      status: 'in-progress',
    });

    expect(() => validateHandleParams(input)).toThrow('Expected completed status but got in-progress');
  });

  test('should throw error when id is missing', () => {
    const { id: _id, ...rest } = validCommunication;
    const input = createMockZambdaInput(rest);

    expect(() => validateHandleParams(input)).toThrow('Communication is missing id');
  });
});
