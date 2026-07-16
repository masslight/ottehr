import { describe, expect, it } from 'vitest';
import { repairGeneratedReportCode } from '../../src/features/reports/adHoc/repairReportCode';

// `element.innerHTML += html` re-parses ALL existing children, so an already-painted chart <canvas>
// comes back blank — the confirmed "header then giant blank area" bug in saved ad-hoc reports. The
// transform rewrites the pattern to insertAdjacentHTML('beforeend', …), which preserves children.
describe('repairGeneratedReportCode', () => {
  it('rewrites the exact broken pattern (chart canvas then innerHTML += table)', () => {
    const code =
      "const container = document.createElement('div');\n" +
      'new Chart(canvas, config);\n' +
      "container.innerHTML += '<h3>Details</h3><table><thead><tr><th>A</th></tr></thead><tbody></tbody></table>';\n";
    const out = repairGeneratedReportCode(code);
    expect(out).toContain(
      "container.insertAdjacentHTML('beforeend', '<h3>Details</h3><table><thead><tr><th>A</th></tr></thead><tbody></tbody></table>');"
    );
    expect(out).not.toContain('innerHTML +=');
    // Everything else is untouched.
    expect(out).toContain("const container = document.createElement('div');");
    expect(out).toContain('new Chart(canvas, config);');
  });

  it('does not truncate an RHS containing semicolons inside a string', () => {
    const code = 'el.innerHTML += \'<div style="color:red;">x&nbsp;y</div>\';';
    expect(repairGeneratedReportCode(code)).toBe(
      "el.insertAdjacentHTML('beforeend', '<div style=\"color:red;\">x&nbsp;y</div>');"
    );
  });

  it('handles a template-literal RHS spanning interpolations, nested quotes, and lines', () => {
    const code =
      'rows.forEach(r => {\n' +
      '  body.innerHTML += `<tr><td style="color:red;">${r.name || \'n/a\'}</td><td>${fmt({ v: r.count })}</td></tr>`;\n' +
      '});\n';
    const out = repairGeneratedReportCode(code);
    expect(out).toContain(
      "body.insertAdjacentHTML('beforeend', `<tr><td style=\"color:red;\">${r.name || 'n/a'}</td><td>${fmt({ v: r.count })}</td></tr>`);"
    );
    expect(out).not.toContain('innerHTML +=');
    // The surrounding forEach structure survives intact.
    expect(out.startsWith('rows.forEach(r => {\n')).toBe(true);
    expect(out.endsWith('});\n')).toBe(true);
  });

  it('rewrites multiple occurrences in one file, including bracket/call LHS chains', () => {
    const code =
      "a.innerHTML += '<b>1;2</b>';\n" +
      'cells[i].innerHTML += `<i>${x}</i>`\n' +
      "document.getElementById('drill').innerHTML += '<p>done;</p>';\n";
    const out = repairGeneratedReportCode(code);
    expect(out).toBe(
      "a.insertAdjacentHTML('beforeend', '<b>1;2</b>');\n" +
        "cells[i].insertAdjacentHTML('beforeend', `<i>${x}</i>`)\n" +
        "document.getElementById('drill').insertAdjacentHTML('beforeend', '<p>done;</p>');\n"
    );
  });

  it('leaves plain X.innerHTML = Y (single =) untouched', () => {
    const code =
      "drill.innerHTML = '<h3>Detail</h3>';\n" + // legitimate overwrite of a dedicated container
      'el.innerHTML = a + b;\n' +
      "document.body.innerHTML = '';\n";
    expect(repairGeneratedReportCode(code)).toBe(code);
  });

  it('is idempotent — running it twice is a no-op', () => {
    const code =
      'container.innerHTML += \'<h3>T</h3><table><tr><td style="padding:2px;">x</td></tr></table>\';\n' +
      "drill.innerHTML = '<p>overwrite ok</p>';\n";
    const once = repairGeneratedReportCode(code);
    expect(repairGeneratedReportCode(once)).toBe(once);
  });

  it('returns a no-match input unchanged, byte for byte', () => {
    const code =
      "const t = document.createElement('table');\n" +
      "t.textContent = 'innerHTML += is mentioned in this string only';\n" +
      '// comment: el.innerHTML += "<b>never rewritten</b>";\n' +
      'parent.appendChild(t);\n';
    expect(repairGeneratedReportCode(code)).toBe(code);
  });

  it('does not rewrite the pattern when it appears inside a string literal', () => {
    const code = "note.textContent = 'avoid el.innerHTML += x in reports';";
    expect(repairGeneratedReportCode(code)).toBe(code);
  });

  it('preserves a newline (ASI) terminator and continues multi-line concatenations', () => {
    const code = "el.innerHTML += '<td>a;</td>' +\n  '<td>b</td>'\nnext();";
    expect(repairGeneratedReportCode(code)).toBe(
      "el.insertAdjacentHTML('beforeend', '<td>a;</td>' +\n  '<td>b</td>')\nnext();"
    );
  });

  it('leaves an occurrence it cannot parse cleanly unchanged (fail safe)', () => {
    const code = "el.innerHTML += '<b>unterminated"; // RHS string never closes
    expect(repairGeneratedReportCode(code)).toBe(code);
  });

  it('the rewritten code is behavior-equivalent: appended HTML lands after existing children', () => {
    // Simulate the DOM difference that motivates the fix: innerHTML += wipes prior children;
    // insertAdjacentHTML preserves them. Run the repaired code against a stub and check the
    // canvas-equivalent child survives.
    const children: string[] = ['<canvas painted>'];
    const el = {
      insertAdjacentHTML: (pos: string, html: string) => {
        expect(pos).toBe('beforeend');
        children.push(html);
      },
    };
    const repaired = repairGeneratedReportCode("el.innerHTML += '<table><tr><td>x;</td></tr></table>';");

    new Function('el', repaired)(el);
    expect(children).toEqual(['<canvas painted>', '<table><tr><td>x;</td></tr></table>']);
  });
});
