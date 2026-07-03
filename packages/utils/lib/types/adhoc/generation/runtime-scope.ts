// VALIDATION + RENDERING half of the runtime-scope single source of truth. The data lives in
// ./runtime-scope.catalog (zod-free, so the iframe bundle can deep-import it); this module parses it
// with real Zod schemas AT MODULE LOAD — a malformed entry throws here instead of silently feeding
// the model a broken contract — and renders the generation prompt's EXECUTION CONTRACT and
// COMPONENTS sections entirely from it.
//
// Consequences worth keeping true:
// - nothing component- or scope-related is hardcoded in the prompt (or in any helper); every name,
//   signature, route, format and rule is interpolated from the catalog;
// - the component NAMES are exported as TYPES, which the iframe's scope.ts imports type-only to bind
//   the real React components — a compile error if the two ever drift.
import { z } from 'zod';
import { ADHOC_LINK_ROUTES } from '../sandbox/events';
import {
  ADHOC_LINK_ROUTE_DOCS,
  COMPONENT_PATTERNS,
  EXECUTION_CONTRACT_RULES,
  MUI_COMPONENT_NAMES,
  REPORT_COMPONENTS,
  REPORT_FACTORY_NAME,
  REPORT_ROOT_NAME,
  ReportComponentDoc,
  RUNTIME_SCOPE_PARAM_NAMES,
  RUNTIME_SCOPE_PARAMS,
  ScopeDocItems,
  ScopeDocRule,
  VALUE_FORMATS,
} from './runtime-scope.catalog';

export * from './runtime-scope.catalog';

// ---------------------------------------------------------------------------------------------
// Validation — every piece of the catalog the prompt and the runtime depend on.
// ---------------------------------------------------------------------------------------------

/** Documentation strings are single-line: rendering owns the layout, entries own the meaning. */
const DocLine = z
  .string()
  .trim()
  .min(1)
  .refine((s) => !s.includes('\n'), { message: 'doc strings must be single-line (rendering wraps them)' });

/** Nested lists may be a thunk in the catalog; validate (and render) what the model actually sees. */
const resolveItems = (items: ScopeDocItems): readonly string[] => (typeof items === 'function' ? items() : items);

const DocRuleSchema = z.union([
  DocLine,
  z
    .object({ text: DocLine, items: z.custom<ScopeDocItems>() })
    .transform((rule) => ({ text: rule.text, items: resolveItems(rule.items) }))
    .pipe(z.object({ text: DocLine, items: z.array(DocLine).min(1) })),
]);

const uniqueNames = (values: readonly string[]): boolean => new Set(values).size === values.length;

const ScopeParamsSchema = z
  .array(z.object({ name: z.string().regex(/^[A-Za-z_$][\w$]*$/), description: DocLine }))
  .min(1)
  .refine((params) => uniqueNames(params.map((p) => p.name)), { message: 'scope parameter names must be unique' });

const ReportComponentsSchema = z.record(
  z.string().regex(/^[A-Z][A-Za-z0-9]*$/),
  z.object({ props: DocLine, children: DocLine.optional(), rules: z.array(DocRuleSchema).optional(), summary: DocLine })
);

const NamesSchema = z
  .array(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/))
  .min(1)
  .refine(uniqueNames, { message: 'names must be unique' });

// Real parse of the whole catalog. Anything the prompt or the runtime reads is covered.
z.object({
  reportRootName: z.string().regex(/^[A-Za-z_$][\w$]*$/),
  factoryName: z.string().regex(/^[A-Za-z_$][\w$]*$/),
  scopeParams: ScopeParamsSchema,
  reportComponents: ReportComponentsSchema,
  muiComponentNames: NamesSchema,
  valueFormats: NamesSchema,
  // The documented routes must be exactly the routes the sandbox event contract accepts — the prompt
  // may never advertise a route the SPA would reject, or omit one it supports.
  linkRoutes: z
    .array(z.string())
    .refine((routes) => uniqueNames(routes) && routes.length === ADHOC_LINK_ROUTES.length, {
      message: 'documented link routes must match ADHOC_LINK_ROUTES',
    })
    .refine((routes) => routes.every((r) => (ADHOC_LINK_ROUTES as readonly string[]).includes(r)), {
      message: 'documented link routes must match ADHOC_LINK_ROUTES',
    }),
  executionContractRules: z.array(DocRuleSchema).min(1),
  componentPatterns: z.array(DocRuleSchema).min(1),
}).parse({
  reportRootName: REPORT_ROOT_NAME,
  factoryName: REPORT_FACTORY_NAME,
  scopeParams: RUNTIME_SCOPE_PARAMS,
  reportComponents: REPORT_COMPONENTS,
  muiComponentNames: MUI_COMPONENT_NAMES,
  valueFormats: VALUE_FORMATS,
  linkRoutes: Object.keys(ADHOC_LINK_ROUTE_DOCS),
  executionContractRules: EXECUTION_CONTRACT_RULES,
  componentPatterns: COMPONENT_PATTERNS,
});

// Documentation cross-references components by name ("use Report.VegaChart for that"). Those names
// must be catalog keys — otherwise the prompt advertises a component the frame does not have.
const referencedComponents = (rule: ScopeDocRule): string[] => {
  const text = typeof rule === 'string' ? rule : [rule.text, ...resolveItems(rule.items)].join(' ');
  return [...text.matchAll(/\bReport\.([A-Za-z0-9]+)/g)].map((m) => m[1]);
};

const allRules: ScopeDocRule[] = [
  ...EXECUTION_CONTRACT_RULES,
  ...COMPONENT_PATTERNS,
  ...Object.values<ReportComponentDoc>(REPORT_COMPONENTS).flatMap((doc) => [doc.summary, ...(doc.rules ?? [])]),
];
z.array(z.enum(Object.keys(REPORT_COMPONENTS) as [string, ...string[]])).parse(allRules.flatMap(referencedComponents));

// ---------------------------------------------------------------------------------------------
// Rendering — catalog → prompt text. Layout lives here only.
// ---------------------------------------------------------------------------------------------

const WRAP_WIDTH = 105;

/** Word-wrap one logical line, prefixing the first line and indenting the continuations. */
function wrapLine(text: string, firstPrefix: string, continuationPrefix: string): string {
  const lines: string[] = [];
  let current = firstPrefix;
  let empty = true;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!empty && current.length + 1 + word.length > WRAP_WIDTH) {
      lines.push(current);
      current = continuationPrefix + word;
    } else {
      current = empty ? current + word : `${current} ${word}`;
    }
    empty = false;
  }
  lines.push(current);
  return lines.join('\n');
}

/** A rule bullet (plus its nested items, if any): `prefix` opens the first line, `indent` aligns
 *  every continuation line and the nested items under it. */
function renderRule(rule: ScopeDocRule, prefix: string, indent: string): string {
  if (typeof rule === 'string') return wrapLine(rule, prefix, indent);
  const itemIndent = `${indent}  `;
  return [
    wrapLine(rule.text, prefix, indent),
    ...resolveItems(rule.items).map((item) => wrapLine(item, `${itemIndent}• `, `${itemIndent}  `)),
  ].join('\n');
}

/** The JSX shape of a component: the tag comes from the catalog KEY, the rest from its entry. */
export function componentSignature(name: string, doc: ReportComponentDoc): string {
  const tag = `Report.${name}`;
  return doc.children !== undefined ? `<${tag} ${doc.props}>${doc.children}</${tag}>` : `<${tag} ${doc.props} />`;
}

/** `- <signature> — <summary>` followed by the component's own indented rules. */
function renderComponent(name: string, doc: ReportComponentDoc): string {
  const rules = doc.rules ?? [];
  return [
    wrapLine(`${componentSignature(name, doc)} — ${doc.summary}`, '- ', '  '),
    ...rules.map((rule) => renderRule(rule, '  ', '    ')),
  ].join('\n');
}

/** The signature of the function the generated body is: `buildReport(React, MUI, …)`. */
export function reportFactorySignature(): string {
  const params = RUNTIME_SCOPE_PARAM_NAMES.join(', ');
  return `function ${REPORT_FACTORY_NAME}(${params}) { <YOUR CODE>; return ${REPORT_ROOT_NAME}; }`;
}

/** The generation prompt's EXECUTION CONTRACT section: what the body is, what is injected into it,
 *  and the rules that follow from how it is executed. */
export function buildExecutionContractPromptSection(): string {
  const params = RUNTIME_SCOPE_PARAMS.map((p) => wrapLine(`"${p.name}": ${p.description}`, '- ', '  '));
  const rules = EXECUTION_CONTRACT_RULES.map((rule) => renderRule(rule, '- ', '  '));
  return [
    'EXECUTION CONTRACT — your code is the BODY of this function, run inside a sandboxed iframe:',
    `  ${reportFactorySignature()}`,
    ...params,
    ...rules,
  ].join('\n');
}

/** The generation prompt's COMPONENTS section, built entirely from the catalog. */
export function buildComponentsPromptSection(): string {
  const components = Object.entries(REPORT_COMPONENTS).map(([name, doc]) => renderComponent(name, doc));
  const patterns = COMPONENT_PATTERNS.map((rule) => renderRule(rule, '- ', '  '));
  return [
    'COMPONENTS — the toolkit injected into your code. PREFER Report.* components; use MUI building blocks',
    'only for custom UI when no Report component fits.',
    '',
    'REPORT COMPONENTS:',
    ...components,
    wrapLine(
      `MUI components available: ${MUI_COMPONENT_NAMES.join(', ')}. Nothing else exists in the frame (no icons, ` +
        `no other libraries, no network).`,
      '- ',
      '  '
    ),
    '',
    'INTERACTIVITY & PATTERNS (all inside the frame, over the in-memory "data"):',
    ...patterns,
  ].join('\n');
}
