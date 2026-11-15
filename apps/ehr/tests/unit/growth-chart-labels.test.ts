import * as echarts from 'echarts';
import { LmsRow } from 'utils/lib/helpers/vitals/growth-lms';
import { GrowthChartId } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it } from 'vitest';
import { buildGrowthChartOption } from '../../src/features/flowsheets/growthChartOption';

// WHO-like weight-for-age (0-24 months) and CDC-like weight-for-age (24-240 months) tables, L = 0.
const who: LmsRow[] = Array.from({ length: 25 }, (_, month) => [month, 0, 3.3 + month * 0.37, 0.12]);
const cdc: LmsRow[] = Array.from({ length: 217 }, (_, i) => [24 + i, 0, 12 + i * 0.25, 0.15]);

interface Label {
  text: string;
  x: number;
  y: number;
  size: number;
}
/** The chart's text labels as drawn (ECharts SSR), with their positions. */
const labelsOf = (chartId: GrowthChartId, table: LmsRow[]): Label[] => {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 520, height: 420 });
  chart.setOption({ ...buildGrowthChartOption(chartId, 'female', table, []).option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(([, attrs, text]) => {
    const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(attrs) ?? [];
    const size = Number(/font-size:([\d.]+)px/.exec(attrs)?.[1] ?? 12);
    return { text, x: Number(x), y: Number(y), size };
  });
};

describe('growth chart labels', () => {
  it.each([
    ['who-wfa', who],
    ['cdc-wfa', cdc],
  ] as const)('%s: the percentile labels at the right end clear the lbs axis numbers', (chartId, table) => {
    const labels = labelsOf(chartId, table);
    const percentiles = labels.filter((label) => /^\d{1,2}$/.test(label.text) && label.x > 400);
    const lbs = labels.filter((label) => /^\d+\.\d$/.test(label.text) && label.x > 400);
    expect(percentiles.length).toBeGreaterThan(0);
    expect(lbs.length).toBeGreaterThan(0);
    // A label's right edge, at about 0.6 em a character.
    const rightEdge = Math.max(...percentiles.map((label) => label.x + label.text.length * label.size * 0.6));
    expect(rightEdge).toBeLessThanOrEqual(Math.min(...lbs.map((label) => label.x)));
  });
});
