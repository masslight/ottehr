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

export enum CONFIG_INJECTION_KEYS {
  BOOKING = '__TEST_BOOKING_CONFIG__',
  LOCATIONS = '__TEST_LOCATION_CONFIG__',
  INTAKE_PAPERWORK = '__TEST_INTAKE_PAPERWORK_CONFIG__',
  VIRTUAL_INTAKE_PAPERWORK = '__TEST_VIRTUAL_INTAKE_PAPERWORK_CONFIG__',
  VALUE_SETS = '__TEST_VALUE_SETS__',
}

export const createProxyConfigObject = <T extends object>(
  getConfigWithOverrides: (overrides?: Partial<T>) => T,
  injectionKey: CONFIG_INJECTION_KEYS
): T => {
  // Helper to get injected overrides at ACCESS time (not module load time)
  // This allows tests to inject config after the module has loaded
  const getInjectedOverrides = (): Partial<T> | undefined => {
    if (typeof window !== 'undefined' && (window as any)[injectionKey]) {
      return (window as any)[injectionKey];
    }
    return undefined;
  };

  return new Proxy({} as T, {
    get(_target, prop) {
      const config = getConfigWithOverrides(getInjectedOverrides());
      return config[prop as keyof T];
    },
    ownKeys(_target) {
      const config = getConfigWithOverrides(getInjectedOverrides());
      return Reflect.ownKeys(config);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const config = getConfigWithOverrides(getInjectedOverrides());
      return Reflect.getOwnPropertyDescriptor(config, prop);
    },
  });
};
