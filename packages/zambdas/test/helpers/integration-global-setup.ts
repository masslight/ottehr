import type { TestProject } from 'vitest/node';
import app from '../../src/local-server/index';

export default function setup(project: TestProject): void {
  console.log('Imported local server', app);
  project.provide('EXECUTE_ZAMBDA_URL', 'http://localhost:3000/local');
}

// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars
declare namespace vitest {
  export interface ProvidedContext {
    EXECUTE_ZAMBDA_URL: string;
  }
}
