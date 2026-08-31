// The reconciliation call's server side: what it withholds, and what it force-includes.

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { TEMPLATE_RECONCILE_INSTRUCTION } from '../src/ehr/easy-chart-plan/helpers';
import { validateRequestParameters } from '../src/ehr/easy-chart-plan/validateRequestParameters';

const request = (body: Record<string, unknown>): ReturnType<typeof validateRequestParameters> =>
  validateRequestParameters({ body: JSON.stringify({ narrative: 'n', ...body }), headers: {} } as never);

describe('reconcileTemplate on the request', () => {
  it('is off unless explicitly set, so an ordinary plan is untouched', () => {
    expect(request({}).reconcileTemplate).toBe(false);
    expect(request({ reconcileTemplate: 'yes' }).reconcileTemplate).toBe(false);
  });

  it('is on only for a literal true', () => {
    expect(request({ reconcileTemplate: true }).reconcileTemplate).toBe(true);
  });
});

describe('the reconciliation instruction', () => {
  it('asks for removals, which is the opposite of what `incremental` alone says', () => {
    // `incremental` tells the model to chart only what is NEW. Without this, the pass adds and never
    // takes back the template defaults the visit contradicts — the whole reason for the second call.
    expect(TEMPLATE_RECONCILE_INSTRUCTION).toContain('remove-exam-finding');
    expect(TEMPLATE_RECONCILE_INSTRUCTION).toContain('remove-diagnosis');
    expect(TEMPLATE_RECONCILE_INSTRUCTION).toContain('remove-cpt');
  });

  it('forbids a bare diagnosis removal, so a swap never leaves the note without one', () => {
    expect(TEMPLATE_RECONCILE_INSTRUCTION).toMatch(/never a bare\s+removal/);
  });

  it('forbids rewriting the note text, which the first pass already wrote from this narrative', () => {
    expect(TEMPLATE_RECONCILE_INSTRUCTION).toContain('Do NOT emit edit-note-text');
  });

  it('sets a precision bar, because a wrong removal deletes what the provider dictated', () => {
    expect(TEMPLATE_RECONCILE_INSTRUCTION).toMatch(/when in doubt, leave it/i);
  });

  it('names no template and interpolates nothing — no caller text reaches the prompt', () => {
    expect(TEMPLATE_RECONCILE_INSTRUCTION).not.toContain('${');
  });
});

describe('the zambda withholds the template list on that call', () => {
  const SOURCE = readFileSync(join(__dirname, '../src/ehr/easy-chart-plan/index.ts'), 'utf8');

  it('does not even read the practice templates when reconciling', () => {
    // Withholding the list is a harder constraint than instructing the model not to apply one: there is
    // no title left to name. It also drops the largest block in the tail from a call that cannot use it.
    expect(SOURCE).toContain('params.reconcileTemplate ? undefined : readTemplateTitles');
  });

  it('drops the caller-supplied fallback too, so the client cannot put the list back', () => {
    expect(SOURCE).toMatch(/templateTitles: params\.reconcileTemplate \? undefined :/);
  });

  it('force-includes the instruction only on that call', () => {
    expect(SOURCE).toContain('mustAddress: params.reconcileTemplate ? TEMPLATE_RECONCILE_INSTRUCTION : undefined');
  });
});
