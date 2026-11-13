import { ChangeEvent, useState } from 'react';
import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils/lib/utils/convert';

type Unit = 'metric' | 'imperial';
type InputChange = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

export interface PairedMeasureState {
  metricText: string;
  imperialText: string;
  handleMetricChange: (e: InputChange) => void;
  handleImperialChange: (e: InputChange) => void;
  /** The metric value to save; undefined when empty or not a number. */
  value: number | undefined;
  /** Text was typed that is not a number. */
  invalid: boolean;
  /** Empty both fields. */
  clear: () => void;
}

/**
 * A metric/imperial input pair with one stored metric value: typing in either field fills the other, the field
 * being typed in keeps its raw text (as the head circumference card does), imperial is converted on entry.
 */
export const usePairedMeasure = (
  initialMetric: number | undefined,
  toMetric: (imperial: number) => number,
  toImperial: (metric: number) => number,
  metricDigits: number
): PairedMeasureState => {
  const [metric, setMetric] = useState<number | undefined>(initialMetric);
  const [editing, setEditing] = useState<{ unit: Unit; text: string }>();
  const handle = (unit: Unit) => (e: InputChange) => {
    const text = e.target.value;
    setEditing({ unit, text });
    const typed = textToNumericValue(text);
    setMetric(typed === undefined ? undefined : unit === 'metric' ? typed : toMetric(typed));
  };
  const asText = (unit: Unit, derived: number | undefined): string =>
    editing?.unit === unit ? editing.text : derived === undefined ? '' : `${derived}`;
  return {
    metricText: asText('metric', metric === undefined ? undefined : roundNumberToDecimalPlaces(metric, metricDigits)),
    imperialText: asText('imperial', metric === undefined ? undefined : toImperial(metric)),
    handleMetricChange: handle('metric'),
    handleImperialChange: handle('imperial'),
    value: metric,
    invalid: !!editing?.text.trim() && metric === undefined,
    clear: () => {
      setMetric(undefined);
      setEditing(undefined);
    },
  };
};
