import { describe, expect, test } from 'vitest';
import { readErrorBody } from '../../src/ehr/radiology/update-report';

// A failing AdvaPACS response is not guaranteed to be FHIR, or even JSON: a gateway in front of it answers
// with HTML, and empty bodies are common. Reading it must never throw, or the thrown parse error would
// replace the status code and status text that actually say what went wrong.
describe('Radiology update-report - readErrorBody', () => {
  test('pretty-prints a JSON body', async () => {
    const body = { resourceType: 'OperationOutcome', issue: [{ diagnostics: 'Report is locked' }] };
    const result = await readErrorBody(new Response(JSON.stringify(body), { status: 422 }));

    expect(result).toContain('Report is locked');
    expect(result).toContain('\n');
  });

  test('returns a body that is not JSON as-is rather than throwing', async () => {
    const html = '<html><body><h1>502 Bad Gateway</h1></body></html>';

    await expect(readErrorBody(new Response(html, { status: 502 }))).resolves.toBe(html);
  });

  test('describes an empty body instead of returning nothing', async () => {
    await expect(readErrorBody(new Response('', { status: 500 }))).resolves.toBe('<empty>');
  });
});
