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

export enum CONFIG_INJECTION_KEYS {
  BOOKING = '__TEST_BOOKING_CONFIG__',
  LOCATIONS = '__TEST_LOCATION_CONFIG__',
  INTAKE_PAPERWORK = '__TEST_INTAKE_PAPERWORK_CONFIG__',
  VIRTUAL_INTAKE_PAPERWORK = '__TEST_VIRTUAL_INTAKE_PAPERWORK_CONFIG__',
  VALUE_SETS = '__TEST_VALUE_SETS__',
  CONSENT_FORMS = '__TEST_CONSENT_FORMS_CONFIG__',
}

/**
 * Check if an environment value indicates a production environment.
 * Uses case-insensitive check for 'prod' to catch variations like
 * 'production', 'Production', 'PRODUCTION', 'prod', 'production-us', etc.
 */
const isProductionEnv = (envValue: string | undefined): boolean => {
  return envValue?.toLowerCase().includes('prod') ?? false;
};

/**
 * Check if the current environment allows test config injection.
 * Test config injection is only allowed in non-production environments.
 *
 * This is a security measure to prevent test overrides from being used in production.
 */
const isTestInjectionAllowed = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check window-level env that apps might expose
  const windowEnv = (window as unknown as Record<string, unknown>).__VITE_APP_ENV__ as string | undefined;
  if (isProductionEnv(windowEnv)) {
    return false;
  }

  // Check if import.meta.env is available (Vite transforms this at build time)
  // Cast to any because import.meta.env only exists in Vite contexts
  try {
    const meta = import.meta as { env?: { VITE_APP_ENV?: string } };
    if (isProductionEnv(meta.env?.VITE_APP_ENV)) {
      return false;
    }
  } catch {
    // import.meta.env not available in this context
  }

  return true;
};

export const createProxyConfigObject = <T extends object>(
  getConfigWithOverrides: (overrides?: Partial<T>) => T,
  injectionKey: CONFIG_INJECTION_KEYS
): T => {
  // Helper to get injected overrides at ACCESS time (not module load time)
  // This allows tests to inject config after the module has loaded
  //
  // SECURITY: Test config injection is only allowed in non-production environments
  const getInjectedOverrides = (): Partial<T> | undefined => {
    if (!isTestInjectionAllowed()) {
      return undefined;
    }

    if ((window as any)[injectionKey]) {
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
