import { describe, expect, it } from 'vitest';
import { ADHOC_LINK_ROUTES } from '../sandbox/events';
import {
  buildComponentsPromptSection,
  buildExecutionContractPromptSection,
  MUI_COMPONENT_NAMES,
  REPORT_COMPONENTS,
  REPORT_ROOT_NAME,
  REPORT_WRAP_PREFIX,
  RUNTIME_SCOPE_PARAM_NAMES,
  VALUE_FORMATS,
} from './runtime-scope';

// The runtime-scope catalog is the ONE source of truth for what exists inside the report iframe.
// Importing it above already runs its Zod validation (a malformed entry throws at module load);
// these tests pin the two things validation can't: that the executed wrapper and the prompt the
// model reads are both DERIVED from it, so a change in the catalog reaches both.

describe('runtime-scope catalog', () => {
  it('derives the execution wrapper from the injected parameter list', () => {
    expect(REPORT_WRAP_PREFIX).toBe(`(function (${RUNTIME_SCOPE_PARAM_NAMES.join(', ')}) {\n`);
    // The wrapper must be a legal function head for exactly those names.
    expect(() => new Function(...RUNTIME_SCOPE_PARAM_NAMES, 'return null;')).not.toThrow();
  });

  it('documents every injected parameter in the execution contract', () => {
    const section = buildExecutionContractPromptSection();
    for (const name of RUNTIME_SCOPE_PARAM_NAMES) expect(section).toContain(`"${name}"`);
    expect(section).toContain(REPORT_WRAP_PREFIX.slice('(function ('.length, REPORT_WRAP_PREFIX.indexOf(')')));
    expect(section).toContain(`return ${REPORT_ROOT_NAME};`);
  });

  it('documents every Report component, MUI component, link route and value format', () => {
    const section = buildComponentsPromptSection();
    for (const name of Object.keys(REPORT_COMPONENTS)) expect(section).toContain(`<Report.${name}`);
    for (const name of MUI_COMPONENT_NAMES) expect(section).toContain(name);
    // Routes the prompt advertises are exactly the routes the sandbox event contract accepts.
    for (const route of ADHOC_LINK_ROUTES) expect(section).toContain(`route "${route}"`);
    for (const format of VALUE_FORMATS) expect(section).toContain(format);
  });

  it('renders documentation as wrapped, indented bullets (no runaway lines)', () => {
    const lines = [buildExecutionContractPromptSection(), buildComponentsPromptSection()].join('\n').split('\n');
    expect(lines.every((line) => line.length <= 110)).toBe(true);
  });
});
