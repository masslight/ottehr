declare module 'vitest' {
  export interface ProvidedContext {
    EXECUTE_ZAMBDA_URL: string;
  }
}

// mark this file as a module so augmentation works correctly
export {};
