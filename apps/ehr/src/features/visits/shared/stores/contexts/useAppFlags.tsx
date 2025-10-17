import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppFlags = {
  isInPerson: boolean;
};

const initialFlags: AppFlags = {
  isInPerson: false,
};

interface AppFlagsContextType {
  setFlag: <Flag extends keyof AppFlags>(key: Flag, value: AppFlags[Flag]) => void;
  flags: AppFlags;
}

const AppFlagsContext = createContext<AppFlagsContextType | null>(null);

export const AppFlagsProvider: React.FC<{ children: React.ReactNode; flagsToSet?: Partial<AppFlags> }> = ({
  children,
  flagsToSet,
}) => {
  const [flags, setFlags] = useState<AppFlags>({ ...initialFlags, ...flagsToSet });

  const setFlag = useCallback((key: keyof AppFlags, value: AppFlags[keyof AppFlags]) => {
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

  return <AppFlagsContext.Provider value={value}>{children}</AppFlagsContext.Provider>;
};

/**
 * These are not feature flags.
 * This functionality allows implementing DI (Dependency Injection) - dynamically passing values
 * to different parts of the React tree and overriding them in other parts.
 * It can be useful in components that are rendered in different parts of the application.
 */
export function useAppFlags(): AppFlags;
export function useAppFlags(flagsToSet: Partial<AppFlags>): AppFlags; // set flags
export function useAppFlags(arg?: Partial<AppFlags> | keyof AppFlags): AppFlags {
  const context = useContext(AppFlagsContext);

  useEffect(() => {
    if (!context) {
      return;
    }

    if (arg && typeof arg === 'object') {
      Object.entries(arg).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          context?.setFlag(key as keyof AppFlags, value);
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
