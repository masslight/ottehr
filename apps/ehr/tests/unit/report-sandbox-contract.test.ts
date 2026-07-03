import { AdHocFrameEventSchema, transpileReportJsx } from 'utils';
import { describe, expect, it } from 'vitest';
import { hrefForOpenLink } from '../../src/features/report-builder/hooks/links';
import {
  injectVegaData,
  normalizeCategoryAxes,
  withEChartsDefaults,
  withResponsiveSize,
  withVegaTheme,
} from '../../src/features/report-builder/runtime/components/chart-utils';

// Design requirement: "generated-report behavior is worth testing against fixed sample code (the
// events it emits, how it renders)". These tests pin the deterministic halves of that contract —
// the SPA-side event whitelist/URL building and the chart-config normalization the runtime
// components apply — without calling the LLM.

describe('frame event whitelist + navigation (SPA side)', () => {
  it('accepts only whitelisted events with valid shapes', () => {
    expect(AdHocFrameEventSchema.safeParse({ event: 'openLink', options: { type: 'patient', id: 'p1' } }).success).toBe(
      true
    );
    expect(AdHocFrameEventSchema.safeParse({ event: 'openLink', options: { type: 'patient' } }).success).toBe(false);
    expect(AdHocFrameEventSchema.safeParse({ event: 'evalCode', options: { type: 'x' } }).success).toBe(false);
    expect(
      AdHocFrameEventSchema.safeParse({ event: 'openLink', options: { type: 'external', url: 'x' } }).success
    ).toBe(false);
  });

  it('builds URLs only from SPA-owned templates', () => {
    expect(hrefForOpenLink({ type: 'patient', id: 'p1' })).toBe('/patient/p1');
    expect(hrefForOpenLink({ type: 'visitNote', id: 'a1' })).toBe('/in-person/a1');
    expect(hrefForOpenLink({ type: 'trackingBoard' })).toBe('/visits');
    // Ids are encoded — a crafted id cannot smuggle path segments or a query.
    expect(hrefForOpenLink({ type: 'patient', id: '../admin?x=1' })).toBe('/patient/..%2Fadmin%3Fx%3D1');
    expect(hrefForOpenLink({ type: 'patient', id: '  ' })).toBeUndefined();
  });

  it('re-validates internal hrefs against the allow-listed prefixes', () => {
    expect(hrefForOpenLink({ type: 'internal', href: '/visits?tab=prebooked' })).toBe('/visits?tab=prebooked');
    expect(hrefForOpenLink({ type: 'internal', href: '/in-person/a1/review-and-sign' })).toBe(
      '/in-person/a1/review-and-sign'
    );
    expect(hrefForOpenLink({ type: 'internal', href: 'https://evil.example' })).toBeUndefined();
    expect(hrefForOpenLink({ type: 'internal', href: '//evil.example' })).toBeUndefined();
    expect(hrefForOpenLink({ type: 'internal', href: '/admin/secrets' })).toBeUndefined();
  });
});

describe('in-frame transpilation of the JSX artifact', () => {
  it('turns the stored JSX into runnable createElement calls (with a legal top-level return)', () => {
    const result = transpileReportJsx(`
      function ReportRoot() { return <Report.Kpi label="Total" value={data.length} />; }
      return ReportRoot;
    `);
    expect('code' in result).toBe(true);
    if ('code' in result) {
      expect(result.code).toContain('React.createElement');
      expect(result.code).not.toContain('<Report.Kpi');
    }
  });

  it('passes plain-JS artifacts through unchanged (pre-JSX saved reports keep working)', () => {
    const legacy = `function ReportRoot() { return React.createElement('div', null, data.length); }\nreturn ReportRoot;`;
    const result = transpileReportJsx(legacy);
    expect('code' in result && result.code.trim()).toBe(legacy.trim());
  });

  it('reports a syntax error instead of executing garbage', () => {
    const result = transpileReportJsx(`function ReportRoot() { return <div>; } return ReportRoot;`);
    // Either the transpiler rejects it, or the (still broken) output fails the runtime's own
    // Function-compile — the frame surfaces an error either way; here we pin the transpiler side.
    if ('error' in result) expect(result.error).toBeTruthy();
    else expect(() => new Function('React', 'MUI', 'Report', 'data', 'schema', result.code)).toThrow();
  });
});

describe('runtime chart-config normalization', () => {
  it('vega: injects inline rows, strips remote urls, keeps the spec responsive', () => {
    const rows = [{ a: 1 }];
    const spec = { mark: 'bar', data: { url: 'https://evil.example/x.json' }, encoding: {} };
    const injected = injectVegaData(spec, rows);
    expect(JSON.stringify(injected)).not.toContain('evil.example');
    expect(injected.data).toEqual({ values: rows });

    const sized = withResponsiveSize({ mark: 'bar' });
    expect(sized.width).toBe('container');
    expect(typeof sized.height).toBe('number');
  });

  it('vega: faceted specs keep their own sizing (container width is invalid there)', () => {
    const sized = withResponsiveSize({ facet: { field: 'x' }, spec: { mark: 'bar' }, width: 'container' });
    expect('width' in sized).toBe(false);
  });

  it('vega: the default theme merges UNDER the spec config (spec wins per key)', () => {
    const themed = withVegaTheme({ config: { axis: { labelColor: 'red' } } });
    const config = themed.config as Record<string, unknown>;
    expect((config.axis as Record<string, unknown>).labelColor).toBe('red');
    expect(config.mark).toEqual({ tooltip: true }); // default kept where the spec is silent
  });

  it('echarts: adds a contained grid and dataZoom only for crowded cartesian charts', () => {
    const crowded = withEChartsDefaults(
      { xAxis: { type: 'category', data: Array.from({ length: 30 }, (_, i) => `c${i}`) }, series: [] },
      30
    );
    expect(crowded.grid).toBeDefined();
    expect(Array.isArray(crowded.dataZoom)).toBe(true);

    const sparse = withEChartsDefaults({ xAxis: { type: 'category', data: ['a', 'b'] }, series: [] }, 2);
    expect('dataZoom' in sparse).toBe(false);

    const pie = withEChartsDefaults({ series: [{ type: 'pie', data: [] }] }, 0);
    expect('grid' in pie).toBe(false);
  });

  it('echarts: category labels render un-thinned; the option own axisLabel wins', () => {
    const axis = normalizeCategoryAxes({ type: 'category', axisLabel: { rotate: 90 } }, true) as Record<
      string,
      unknown
    >;
    expect(axis.axisLabel).toEqual({ interval: 0, rotate: 90 });
  });
});
