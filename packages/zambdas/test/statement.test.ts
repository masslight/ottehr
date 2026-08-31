import { getHTMLStatementTemplate, getJSONStatementTemplate } from '../src/shared/statements/get-statement-template';

describe('Statement template tests', () => {
  test('loads HTML statement template payload', () => {
    const payload = getHTMLStatementTemplate('statement-template');

    expect(payload.fileName).toBe('statement-template.html');
    expect(payload.template).toMatch(/<!doctype html>/i);
    expect(payload.logoBase64).toMatch(/^data:image\/png;base64,/);
  });

  test('loads JSON statement template payload', () => {
    const payload = getJSONStatementTemplate('statement-template');
    const parsed = JSON.parse(payload.template) as {
      pageSize?: string;
      defaultStyle?: { font?: string };
      content?: unknown[];
    };

    expect(payload.fileName).toBe('statement-template.json');
    expect(parsed.pageSize).toBe('LETTER');
    expect(parsed.defaultStyle?.font).toBe('Rubik');
    expect(Array.isArray(parsed.content)).toBe(true);
    expect(payload.logoBase64).toMatch(/^data:image\/png;base64,/);
  });

  test('accepts explicit template extension', () => {
    const payload = getJSONStatementTemplate('statement-template.json');

    expect(payload.fileName).toBe('statement-template.json');
  });
});
