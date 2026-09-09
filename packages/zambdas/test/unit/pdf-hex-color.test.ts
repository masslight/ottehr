import { rgb } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import { hexColor } from '../../src/shared/pdf/pdf-utils';

describe('hexColor', () => {
  test('converts a brand hex to the same color pdf-lib would build by hand', () => {
    expect(hexColor('#0F347C')).toEqual(rgb(15 / 255, 52 / 255, 124 / 255));
    expect(hexColor('#FFFFFF')).toEqual(rgb(1, 1, 1));
    expect(hexColor('#000000')).toEqual(rgb(0, 0, 0));
  });

  test('accepts lowercase and a missing leading hash', () => {
    expect(hexColor('0f347c')).toEqual(hexColor('#0F347C'));
  });

  test('drops an alpha suffix, since these fills are opaque', () => {
    expect(hexColor('#1C2536DE')).toEqual(hexColor('#1C2536'));
  });

  test('rejects a value it cannot render rather than drawing the wrong color', () => {
    expect(() => hexColor('rgba(0, 0, 0, 0.12)')).toThrow("Cannot use 'rgba(0, 0, 0, 0.12)' as a PDF color");
    expect(() => hexColor('#FFF')).toThrow();
    expect(() => hexColor('')).toThrow();
  });
});
