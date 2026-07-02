import { describe, expect, it } from 'vitest';
import { runtimeError } from '../src/ehr/generate-adhoc-report';

// The execute-validation vm must mirror the browser iframe runner: deferred-render idioms
// (setTimeout / requestAnimationFrame) and Chart instance/static methods are valid there, so the
// validator must NOT reject them — otherwise a valid report burns the whole retry budget and hard
// fails. Regression guard for the confirmed false-reject finding.
describe('generate-adhoc-report runtimeError (iframe-parity)', () => {
  const schema = {
    fields: [
      { name: 'visitType', type: 'string', values: ['Telemed', 'In-Person'] },
      { name: 'age', type: 'number', min: 1 },
    ],
  };
  const canvas = "var c=document.createElement('canvas');document.body.appendChild(c);";

  it.each([
    [
      'requestAnimationFrame(() => new Chart(...))',
      `${canvas}requestAnimationFrame(function(){ new Chart(c,{type:'bar',data:{}}); });`,
    ],
    [
      'setTimeout deferred render',
      `setTimeout(function(){ var d=document.createElement('div'); d.textContent='x'; document.body.appendChild(d); }, 0);`,
    ],
    ['chart.update()/resize()', `${canvas}var ch=new Chart(c,{type:'line',data:{}});ch.update();ch.resize();`],
    ['Chart.register static', `Chart.register({});${canvas}new Chart(c,{});`],
    [
      'plain synchronous render',
      `var h=document.createElement('h2');h.textContent='Report';document.body.appendChild(h);`,
    ],
  ])('accepts %s', (_label, code) => {
    expect(runtimeError(code, schema)).toBeNull();
  });

  it('still rejects code that genuinely throws', () => {
    expect(runtimeError('someUndefinedFn();', schema)).toContain('is not defined');
  });

  it('still rejects code that renders nothing', () => {
    expect(runtimeError('var x = 1 + 1;', schema)).toContain('rendered nothing');
  });

  it('does not hang on a self-rescheduling animation loop (deferred budget)', () => {
    // requestAnimationFrame(function loop(){ ...; requestAnimationFrame(loop); }) would spin forever
    // if run synchronously without a budget; it must terminate and still count as rendered.
    const code = `${canvas}var n=0;(function loop(){ var d=document.createElement('div'); document.body.appendChild(d); n++; requestAnimationFrame(loop); })();`;
    expect(runtimeError(code, schema)).toBeNull();
  });
});
