import { describe, expect, it } from 'vitest';
import { runtimeError, synthSampleRows } from '../src/ehr/generate-adhoc-report/index';

// A schema shaped like the real encounters dataset (the generator passes the actual schema in, so the
// validator runs against real field metadata + synthetic rows). Field 0 is a date with min/max so code
// that reads schema.fields[0].min works exactly as it does in the browser.

const SCHEMA: any = {
  fields: [
    { name: 'date', type: 'date', min: '2025-06-01', max: '2026-06-30' },
    { name: 'patientId', type: 'string' },
    { name: 'patientName', type: 'string' },
    { name: 'visitStatus', type: 'string', values: ['completed', 'cancelled', 'no-show'] },
    { name: 'visitType', type: 'string', values: ['walk-in', 'scheduled'] },
    { name: 'attendingProvider', type: 'string' },
    { name: 'primaryIcd', type: 'string' },
    { name: 'dischargeDisposition', type: 'string' },
    { name: 'totalCycleMinutes', type: 'number', min: 10, max: 240 },
  ],
};

describe('generate-adhoc-report runtime validation', () => {
  it('synthSampleRows produces type-plausible rows with repeated patientIds for visit-pairing', () => {
    const rows = synthSampleRows(SCHEMA) as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(1);
    expect(typeof rows[0].date).toBe('string');
    expect(typeof rows[0].totalCycleMinutes).toBe('number');
    // patientIds must repeat so reports that pair visits per patient have something to find
    const ids = new Set(rows.map((r) => r.patientId));
    expect(ids.size).toBeLessThan(rows.length);
  });

  it('passes ordinary inline code that renders into document.body', () => {
    const code = `
      const valid = data.filter(r => r.visitStatus !== 'cancelled');
      document.body.innerHTML = '<table><tbody>' +
        valid.map(r => '<tr><td>' + r.patientName + '</td></tr>').join('') + '</tbody></table>';
    `;
    expect(runtimeError(code, SCHEMA)).toBeNull();
  });

  it('passes a renderReport() declaration that renders (runner invokes it as a fallback)', () => {
    const code = `function renderReport(data, schema, Chart) {
      document.body.innerHTML = '<h2>' + data.length + ' visits</h2>';
    }`;
    expect(runtimeError(code, SCHEMA)).toBeNull();
  });

  it('catches an out-of-scope ReferenceError (the 72-Hour Return Analysis bug class)', () => {
    // `r` is used at top level but only defined inside the forEach callback — exactly the real bug.
    const code = `
      const byPatient = {};
      data.forEach(function (r) { (byPatient[r.patientId] = byPatient[r.patientId] || []).push(r); });
      document.body.innerHTML = '<div>' + r.patientId + '</div>';
    `;
    const err = runtimeError(code, SCHEMA);
    expect(err).not.toBeNull();
    expect(err).toMatch(/r is not defined/);
  });

  it('catches a renderReport() declaration that is never invoked and renders nothing', () => {
    // No top-level call and an empty body: compile-checking alone would pass this, but it renders
    // nothing — the original blank-report bug class.
    const code = `function renderReport(data, schema, Chart) { /* never wired up, no output */ }`;
    const err = runtimeError(code, SCHEMA);
    expect(err).not.toBeNull();
    expect(err).toMatch(/rendered nothing/);
  });

  it('catches calling an undefined helper', () => {
    const code = `document.body.appendChild(buildTable(data));`;
    expect(runtimeError(code, SCHEMA)).not.toBeNull();
  });
});
