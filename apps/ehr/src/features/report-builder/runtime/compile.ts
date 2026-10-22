// Turns a transpiled report code body into the report's root element over the injected scope. Shared by the
// iframe runtime (the builder's sandbox) and the EHR's system-report viewer, which evaluates vetted system
// reports in the page itself.
import React from 'react';
import { noComponentReturnedError } from 'utils/lib/types/adhoc/generation/runtime-scope.catalog';

// Run the body via indirect eval named "report-code.js" so a thrown error's stack points into the
// report code. sucrase (the bundled transpiler) preserves line numbers, so stack line − offset maps
// back to the model's own JSX for the repair prompt — no source-map lib needed.
const REPORT_CODE_URL = 'report-code.js';
const REPORT_BODY_LINE_OFFSET = 1; // line 1 is the wrapper `(function (…) {`; the body starts at line 2
const MAX_ERROR_LENGTH = 600;

type ReportFactory = (...args: unknown[]) => unknown;

function compileReport(body: string, paramNames: readonly string[]): ReportFactory {
  // The wrapper names exactly the scope's parameters (transpileReportJsx slices its own wrapper back
  // off), so only those names are in scope for the generated code. Indirect eval runs in global
  // scope (no app closures leak in), same isolation as new Function; the trailing sourceURL names
  // the script for stack traces.
  const wrapped = `(function (${paramNames.join(', ')}) {\n${body}\n})\n//# sourceURL=${REPORT_CODE_URL}`;

  return (0, eval)(wrapped) as ReportFactory;
}

// The generated body must `return` a component (preferred) or an element. The injected scope is ALSO
// handed to the root as props: the contract is that it reads `data`/`schema` from the enclosing
// scope, but a model that slips and writes `function ReportRoot({ data })` would otherwise render a
// silently EMPTY report instead of a working one.
function toElement(returned: unknown, scope: Record<string, unknown>, body: string): React.ReactElement {
  if (typeof returned === 'function') {
    return React.createElement(returned as React.ComponentType<Record<string, unknown>>, { ...scope });
  }
  if (React.isValidElement(returned)) return returned;
  throw new Error(noComponentReturnedError(body));
}

/** Runs a transpiled body over the named scope values and returns the root element it produced. */
export function renderReportCode(
  transpiledBody: string,
  paramNames: readonly string[],
  scope: Record<string, unknown>
): React.ReactElement {
  const factory = compileReport(transpiledBody, paramNames);
  const returned: unknown = factory(...paramNames.map((name) => scope[name]));
  return toElement(returned, scope, transpiledBody);
}

// Turn a thrown value into a compact, model-actionable string: "Name: message (around line N of
// your code)". Only the derived location is kept — never the raw multi-frame stack (noise, huge).
export function describeReportError(e: unknown): string {
  if (!(e instanceof Error)) return String(e).slice(0, MAX_ERROR_LENGTH);
  const match = typeof e.stack === 'string' ? e.stack.match(/report-code\.js:(\d+):\d+/) : null;
  const line = match ? Number(match[1]) - REPORT_BODY_LINE_OFFSET : null;
  const base = e.message ? `${e.name}: ${e.message}` : e.name;
  const located = line && line >= 1 ? `${base} (around line ${line} of your code)` : base;
  return located.slice(0, MAX_ERROR_LENGTH);
}
