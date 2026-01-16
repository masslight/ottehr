import _ from 'lodash';
import { deepFreezeObject } from '../utils';

// we're tweaking the default _ merge behavior here to allow overrides to completely replace arrays
// rather than concatenating them, which is rarely what we want and easy enough to achieve by iterating
// the full desired list in the override value
export const mergeAndFreezeConfigObjects = <T>(overrideConfig: Partial<T>, baseConfig: T): T => {
  const merged = _.mergeWith(_.cloneDeep(overrideConfig), _.cloneDeep(baseConfig), (objValue, srcValue) => {
    if (Array.isArray(srcValue)) {
      return objValue ?? srcValue;
    }
  });

  return deepFreezeObject(merged);
};
