import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type FeatureFlags = {
  css: boolean;
};

const initialFlags: FeatureFlags = {
  css: false,
};

interface FeatureFlagsContextType {
  setFlag: <Flag extends keyof FeatureFlags>(key: Flag, value: FeatureFlags[Flag]) => void;
  flags: FeatureFlags;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | null>(null);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode; flagsToSet?: Partial<FeatureFlags> }> = ({
  children,
  flagsToSet,
}) => {
  const [flags, setFlags] = useState<FeatureFlags>({ ...initialFlags, ...flagsToSet });

  const setFlag = useCallback((key: keyof FeatureFlags, value: FeatureFlags[keyof FeatureFlags]) => {
    setFlags((prevFlags) => {
      if (prevFlags[key] === value) return prevFlags;
      return { ...prevFlags, [key]: value };
    });
  }, []);

  const value = useMemo(
    () => ({
      setFlag,
      flags,
    }),
    [setFlag, flags]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export function useFeatureFlags(): FeatureFlags;
export function useFeatureFlags(flagsToSet: Partial<FeatureFlags>): FeatureFlags; // set flags
export function useFeatureFlags(arg?: Partial<FeatureFlags> | keyof FeatureFlags): FeatureFlags {
  const context = useContext(FeatureFlagsContext);

  useEffect(() => {
    if (!context) {
      return;
    }

    if (arg && typeof arg === 'object') {
      Object.entries(arg).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          context?.setFlag(key as keyof FeatureFlags, value);
        }
      });
    }
  }, [arg, context]);

  if (!context) {
    console.warn('useFeatureFlags must be used within a FeatureFlagsProvider, default values will be used');
    return initialFlags;
  }

  return context.flags;
}
