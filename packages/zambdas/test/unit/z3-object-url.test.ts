import { describe, expect, it } from 'vitest';
import { makeFormTemplateObjectName } from '../../src/ehr/shared/form-template-helpers';
import { makeZ3ObjectUrl, z3ObjectNameDatePrefix } from '../../src/shared/presigned-file-urls/helpers';

const SECRETS = {
  PROJECT_API: 'https://project-api.zapehr.com/v1',
  PROJECT_ID: 'proj-1234',
};

const url = (objectName: string, patientID?: string): string =>
  makeZ3ObjectUrl({ secrets: SECRETS, bucketName: 'form-instances', patientID, objectName });

describe('makeZ3ObjectUrl', () => {
  it('puts the object where the server decided, not where a caller asked', () => {
    expect(url('2026-09-10-1789-completed.pdf', 'patient-1')).toBe(
      'https://project-api.zapehr.com/v1/z3/proj-1234-form-instances/patient-1/2026-09-10-1789-completed.pdf'
    );
  });

  it('omits the patient segment for an organisation-level bucket', () => {
    expect(url('2026-09-10-1789-abc-w9.pdf')).toBe(
      'https://project-api.zapehr.com/v1/z3/proj-1234-form-instances/2026-09-10-1789-abc-w9.pdf'
    );
  });

  /**
   * The whole point of taking a name rather than a URL: none of these can be written down as a bucket, a
   * host, or another patient — the worst they can express is a bad name, and a bad name is refused.
   */
  it('refuses a name that would climb out of its folder', () => {
    for (const bad of ['../other-bucket/x', '..', '../', 'a/b', '/etc/passwd', './x']) {
      expect(() => url(bad, 'patient-1'), bad).toThrow(/Invalid Z3 object name/);
    }
  });

  it('refuses percent-encoding, which would become a separator once decoded', () => {
    for (const bad of ['x%2fy', '%2e%2e%2fetc', 'a%00b']) {
      expect(() => url(bad, 'patient-1'), bad).toThrow(/Invalid Z3 object name/);
    }
  });

  it('refuses a name that is empty, hidden, or absurdly long', () => {
    expect(() => url('', 'patient-1')).toThrow(/Invalid Z3 object name/);
    expect(() => url('.hidden', 'patient-1')).toThrow(/Invalid Z3 object name/);
    expect(() => url('a'.repeat(201), 'patient-1')).toThrow(/Invalid Z3 object name/);
  });

  it('refuses a whole URL, which is what callers used to send', () => {
    expect(() => url('https://attacker.example/collect', 'patient-1')).toThrow(/Invalid Z3 object name/);
  });
});

describe('names this server generates', () => {
  // The check and the generators have to agree, or a legitimate upload is refused on its way back.
  it('accepts a template object name', () => {
    for (const fileName of [
      'w9.pdf',
      'DWC073 work status (rev 2).pdf',
      "o'brien+form!.pdf",
      'a\\b.pdf',
      '../../x.pdf',
    ]) {
      const objectName = makeFormTemplateObjectName(fileName);
      expect(
        () => makeZ3ObjectUrl({ secrets: SECRETS, bucketName: 'form-templates', objectName }),
        fileName
      ).not.toThrow();
    }
  });

  it('accepts a completed-form object name, however the browser named the file', () => {
    // Mirrors `create-completed-form-upload-url`, which is the only other producer of these names.
    const sanitize = (fileName: string): string =>
      fileName
        .replace(/[/\\]/g, '-')
        .replace(/[^\w.-]/g, '_')
        .slice(0, 120) || 'completed-form.pdf';

    for (const fileName of ['scan.pdf', 'my form (signed).pdf', '../../etc/passwd', 'ünïcødé.pdf']) {
      const objectName = `${z3ObjectNameDatePrefix()}-${sanitize(fileName)}`;
      expect(() => url(objectName, 'patient-1'), fileName).not.toThrow();
    }
  });
});
