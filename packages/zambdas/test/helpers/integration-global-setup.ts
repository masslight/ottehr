import { Server } from 'http';
import type { TestProject } from 'vitest/node';
import app from '../../src/local-server/index';

let server: Server;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  // Start the server for integration tests and wait for it to be ready
  await new Promise<void>((resolve, reject) => {
    server = app.listen(3000, () => {
      console.log('Test server started on port 3000');
      resolve();
    });

    server.on('error', (error) => {
      console.error('Server failed to start:', error);
      reject(error);
    });
  });

  project.provide('EXECUTE_ZAMBDA_URL', 'http://localhost:3000/local');

  // Return cleanup function to stop the server after all tests
  return async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('Test server stopped');
          resolve();
        });
      });
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars
declare namespace vitest {
  export interface ProvidedContext {
    EXECUTE_ZAMBDA_URL: string;
  }
}
