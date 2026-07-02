import { describe, expect, it } from 'vitest';
import { sniffVitalsFromNarrative } from '../src/shared/easy-chart/vitals';

// The narrative vitals sweep backstops the planner: any dictated reading the model fails to emit
// gets appended deterministically — including SERIAL readings (initial BP + post-rest recheck).
describe('sniffVitalsFromNarrative', () => {
  it('finds both serial BP readings, HR, and SpO2 in the hypertension narrative', () => {
    const n =
      'His initial vital signs show a blood pressure of 184 over 98, pulse is 76, and oxygen saturation is ' +
      '98 percent on room air. We had him rest quietly in the exam room for 30 minutes, and a repeat manual ' +
      'blood pressure dropped slightly to 176 over 92.';
    const v = sniffVitalsFromNarrative(n);
    const bps = v.filter((x) => x.field === 'vital-blood-pressure');
    expect(bps.map((x) => x.display)).toEqual(['184/98', '176/92']);
    expect(v.find((x) => x.field === 'vital-heartbeat')?.value).toBe(76);
    expect(v.find((x) => x.field === 'vital-oxygen-sat')?.value).toBe(98);
  });

  it('finds a tachycardic HR phrased indirectly', () => {
    const v = sniffVitalsFromNarrative('Heart rate is slightly tachycardic at 115 but regular.');
    expect(v.find((x) => x.field === 'vital-heartbeat')?.value).toBe(115);
  });

  it('does not false-positive on visual acuity, pulses 2+, or follow-up hours', () => {
    const v = sniffVitalsFromNarrative(
      'Visual acuity is 20/20 in both eyes. Distal pulses are strong at 2 plus. Follow up in 48 hours. ' +
        'A repeat blood pressure was not obtained.'
    );
    expect(v).toEqual([]);
  });

  it('dedupes identical restatements but keeps distinct readings', () => {
    const v = sniffVitalsFromNarrative('Heart rate 92. On recheck, heart rate remained 92.');
    expect(v.filter((x) => x.field === 'vital-heartbeat')).toHaveLength(1);
  });

  it('never sweeps thresholds out of instruction sentences', () => {
    const v = sniffVitalsFromNarrative(
      'Provided strict return precautions for worsening shortness of breath, oxygen saturation readings ' +
        'below 90 at home, or a heart rate above 130, in which case call 911.'
    );
    expect(v).toEqual([]);
  });

  it('parses temperature with implied unit', () => {
    const v = sniffVitalsFromNarrative('Temperature is 100.4 in triage.');
    expect(v.find((x) => x.field === 'vital-temperature')?.value).toBe(100.4);
    expect(v.find((x) => x.field === 'vital-temperature')?.unit).toBe('F');
  });
});
