import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../../src/billing/export-billing-claims/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const secrets = createMockSecrets();
const inputWith = (body: any): any => createMockZambdaInput(body, { secrets });

// These are thrown as plain objects, so identity is what pins down which one came back.
const thrownBy = (call: () => unknown): unknown => {
  try {
    call();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('export-billing-claims - validateRequestParameters', () => {
  it('reads a kick-off request with no filters at all', () => {
    expect(validateRequestParameters(inputWith({}))).toEqual({ secrets });
  });

  it('keeps every claims-list filter', () => {
    const filters = {
      searchText: 'Smith',
      type: 'professional',
      arStage: 'patient-ar',
      status: 'denied',
      tag: 'rebill',
      createdFrom: '2026-01-01',
      createdTo: '2026-01-31',
      serviceDateFrom: '2026-01-02',
      serviceDateTo: '2026-01-30',
      payerName: 'Acme',
      payerId: 'P1',
      service: 'telemedicine',
      patientId: 'patient-1',
    };

    expect(validateRequestParameters(inputWith(filters))).toEqual({ ...filters, secrets });
  });

  it('drops paging parameters instead of exporting one page', () => {
    expect(
      validateRequestParameters(
        inputWith({
          status: 'denied',
          offset: 25,
          pageSize: 25,
        })
      )
    ).toEqual({
      status: 'denied',
      secrets,
    });
  });

  it('reads a status check when a taskId is present', () => {
    expect(validateRequestParameters(inputWith({ taskId: 'task-1' }))).toEqual({
      taskId: 'task-1',
      secrets,
    });
  });

  // An empty taskId is nobody's export, so it must not be treated as one.
  it('treats a blank taskId as a kick-off, not a status check', () => {
    expect(
      validateRequestParameters(
        inputWith({
          taskId: '',
          status: 'denied',
        })
      )
    ).toEqual({
      status: 'denied',
      secrets,
    });
  });

  it('rejects a claim type the claims list does not offer', () => {
    expect(() => validateRequestParameters(inputWith({ type: 'dental' }))).toThrow();
  });

  it('throws without a body', () => {
    expect(thrownBy(() => validateRequestParameters(createMockZambdaInput(null, { secrets }) as any))).toBe(
      MISSING_REQUEST_BODY
    );
  });

  it('throws without secrets', () => {
    expect(thrownBy(() => validateRequestParameters(createMockZambdaInput({}) as any))).toBe(MISSING_REQUEST_SECRETS);
  });
});
