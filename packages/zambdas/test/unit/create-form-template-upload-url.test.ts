import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/create-form-template-upload-url/index';
import type { ZambdaInput } from '../../src/shared/types/common';

const inputWith = (body: Record<string, unknown>): ZambdaInput =>
  ({ headers: {}, body: JSON.stringify(body), secrets: {} }) as unknown as ZambdaInput;

describe('create-form-template-upload-url validateRequestParameters', () => {
  it.each(['', '   '])('rejects a blank new template title %j', (title) => {
    expect(() => validateRequestParameters(inputWith({ fileName: 'form.pdf', title }))).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });

  it.each(['', ' \n '])(
    'drops a blank description %j instead of writing it to the DocumentReference',
    (description) => {
      const params = validateRequestParameters(inputWith({ fileName: 'form.pdf', title: 'Consent', description }));

      expect(params.description).toBeUndefined();
    }
  );

  it('keeps a filled title and description', () => {
    const params = validateRequestParameters(
      inputWith({ fileName: 'form.pdf', title: 'Consent', description: 'Signed at check-in' })
    );

    expect(params).toMatchObject({ title: 'Consent', description: 'Signed at check-in' });
  });

  it('still accepts a PDF replacement without a title', () => {
    const params = validateRequestParameters(inputWith({ fileName: 'form.pdf', documentReferenceId: 'doc-1' }));

    expect(params.documentReferenceId).toBe('doc-1');
  });
});
