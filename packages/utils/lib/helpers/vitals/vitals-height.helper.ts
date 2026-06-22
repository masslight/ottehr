import { roundNumberToDecimalPlaces, textToNumericValue } from '../../utils';

const INCHES_PER_CM = 0.393701;
const INCHES_IN_FOOT = 12;

export const HEIGHT_CM_SAVE_PRECISION = 2;
export const HEIGHT_CM_DISPLAY_PRECISION = 1;
export const HEIGHT_INCHES_DISPLAY_PRECISION = 2;

const roundToNearestHalf = (value: number): number => Math.round(value * 2) / 2;

/** A height value with one source of truth: full-precision cm. Build from any unit, read back at any precision (rounding only on read). */
export class HeightMeasurement {
  private constructor(private readonly cm: number) {}

  // --- factories ---------------------------------------------------------

  static fromCm(cm: number): HeightMeasurement {
    return new HeightMeasurement(cm);
  }

  static fromInches(inches: number): HeightMeasurement {
    return new HeightMeasurement(inches / INCHES_PER_CM);
  }

  static fromFeetInches(feet: number, inchRemainder: number): HeightMeasurement {
    return HeightMeasurement.fromInches(feet * INCHES_IN_FOOT + inchRemainder);
  }

  // --- text factories (parse raw user input) -----------------------------

  static fromCmText(text: string): HeightMeasurement | undefined {
    const cm = textToNumericValue(text);
    return cm === undefined ? undefined : HeightMeasurement.fromCm(cm);
  }

  static fromInchesText(text: string): HeightMeasurement | undefined {
    const inches = textToNumericValue(text);
    return inches === undefined ? undefined : HeightMeasurement.fromInches(inches);
  }

  static fromFeetInchesText(feetText: string, inchRemainderText: string): HeightMeasurement | undefined {
    const hasFeet = feetText.trim().length > 0;
    const hasInchRemainder = inchRemainderText.trim().length > 0;
    if (!hasFeet && !hasInchRemainder) return undefined;

    const feet = hasFeet ? textToNumericValue(feetText) : 0;
    const inchRemainder = hasInchRemainder ? textToNumericValue(inchRemainderText) : 0;
    if (feet === undefined || inchRemainder === undefined) return undefined;

    return HeightMeasurement.fromFeetInches(feet, inchRemainder);
  }

  // --- getters -----------------------------------------------------------

  /** Centimeters, rounded to `precision` (defaults to the save precision). */
  getCm(precision: number = HEIGHT_CM_SAVE_PRECISION): number {
    return roundNumberToDecimalPlaces(this.cm, precision);
  }

  /** Total inches, rounded to `precision` (defaults to the display precision). */
  getInches(precision: number = HEIGHT_INCHES_DISPLAY_PRECISION): number {
    return roundNumberToDecimalPlaces(this.cm * INCHES_PER_CM, precision);
  }

  /** Nearest half inch (ties up). Snapped from displayed inches, not raw cm, so feet/inches stay consistent and survive cm round-trips. */
  private getHalfInches(): number {
    return roundToNearestHalf(this.getInches());
  }

  getFeet(): number {
    return Math.floor(this.getHalfInches() / INCHES_IN_FOOT);
  }

  getInchRemainder(): number {
    return this.getHalfInches() % INCHES_IN_FOOT;
  }

  // --- labels ------------------------------------------------------------

  getFeetInchesLabel(): string {
    return `${this.getFeet()}'${this.getInchRemainder()}"`;
  }

  getObservationLabel(): string {
    return `${this.getCm(HEIGHT_CM_DISPLAY_PRECISION)} cm ≈ ${this.getInches()} in ≈ ${this.getFeetInchesLabel()}`;
  }
}

/** Backwards-compatible helper for rendering a stored height observation value. */
export const formatHeightObservationValue = (heightCm: number): string =>
  HeightMeasurement.fromCm(heightCm).getObservationLabel();
