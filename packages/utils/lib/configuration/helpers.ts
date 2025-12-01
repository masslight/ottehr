import _ from 'lodash';
import { deepFreezeObject } from '../utils';

// we're tweaking the default _ merge behavior here to allow overrides to completely replace arrays
// rather than concatenating them, which is rarely what we want and easy enough to achieve by iterating
// the full desired list in the override value
export const mergeAndFreezeConfigObjects = <T>(baseConfig: T, overrideConfig: Partial<T>): T => {
  const merged = _.mergeWith(
    JSON.parse(JSON.stringify(baseConfig)),
    JSON.parse(JSON.stringify(overrideConfig)),
    (objValue, srcValue) => {
      if (Array.isArray(objValue)) {
        return srcValue ?? [];
      }
    }
  );

  return deepFreezeObject(merged);
};
