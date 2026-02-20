import _ from 'lodash';
import { deepFreezeObject } from '../utils/objects';

// we're tweaking the default _ merge behavior here to allow overrides to completely replace arrays
// rather than concatenating them, which is rarely what we want and easy enough to achieve by iterating
// the full desired list in the override value

// Helper type to remove readonly from all properties recursively
type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
  ? { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;

// Deep merge type: recursively merges T and Z
// For arrays: Z replaces T (not merged)
// For objects: properties are recursively merged
// Z properties override T properties
type DeepMerge<T, Z> = T extends readonly any[]
  ? Z extends readonly any[]
    ? Z // Arrays are replaced, not merged
    : T
  : Z extends readonly any[]
  ? Z
  : T extends object
  ? Z extends object
    ? {
        [K in keyof T | keyof Z]: K extends keyof Z
          ? K extends keyof T
            ? DeepMerge<T[K], Z[K]>
            : Z[K]
          : K extends keyof T
          ? T[K]
          : never;
      }
    : Z
  : Z;

export function mergeAndFreezeConfigObjects<T, Z>(
  baseConfig: T,
  overrideConfig: Z,
  freeze: boolean = true
): Mutable<DeepMerge<T, Z>> {
  const merged = _.mergeWith(_.cloneDeep(baseConfig), _.cloneDeep(overrideConfig), (objValue, srcValue) => {
    // For arrays, use override's array entirely (no element-by-element merge)
    // If override doesn't provide an array, fall back to base's array
    if (Array.isArray(srcValue) || Array.isArray(objValue)) {
      return srcValue ?? objValue;
    }
  });

  return (freeze ? deepFreezeObject(merged) : merged) as Mutable<DeepMerge<T, Z>>;
}
