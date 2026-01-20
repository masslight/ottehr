import _ from 'lodash';
import { deepFreezeObject } from '../utils/objects';

// we're tweaking the default _ merge behavior here to allow overrides to completely replace arrays
// rather than concatenating them, which is rarely what we want and easy enough to achieve by iterating
// the full desired list in the override value
export const mergeAndFreezeConfigObjects = <T, Z>(baseConfig: T, overrideConfig: Z): T & Z => {
  const merged = _.mergeWith(_.cloneDeep(baseConfig), _.cloneDeep(overrideConfig), (objValue, srcValue) => {
    // For arrays, use override's array entirely (no element-by-element merge)
    // If override doesn't provide an array, fall back to base's array
    if (Array.isArray(srcValue) || Array.isArray(objValue)) {
      return srcValue ?? objValue;
    }
  });

  return deepFreezeObject(merged);
};
