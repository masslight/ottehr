import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type FeatureFlags = {
  isInPerson: boolean;
};

const initialFlags: FeatureFlags = {
  isInPerson: false,
};

interface FeatureFlagsContextType {
  setFlag: <Flag extends keyof FeatureFlags>(key: Flag, value: FeatureFlags[Flag]) => void;
  flags: FeatureFlags;
}

const AppTypeContext = createContext<FeatureFlagsContextType | null>(null);

export const AppTypeProvider: React.FC<{ children: React.ReactNode; flagsToSet?: Partial<FeatureFlags> }> = ({
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

  return <AppTypeContext.Provider value={value}>{children}</AppTypeContext.Provider>;
};

export function useAppFlags(): FeatureFlags;
export function useAppFlags(flagsToSet: Partial<FeatureFlags>): FeatureFlags; // set flags
export function useAppFlags(arg?: Partial<FeatureFlags> | keyof FeatureFlags): FeatureFlags {
  const context = useContext(AppTypeContext);

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
