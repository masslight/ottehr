import { Server } from 'http';
import type { TestProject } from 'vitest/node';
import app from '../../src/local-server/index';

let server: Server | undefined;
let reusedExistingServer = false;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  // Start the server for integration tests and wait for it to be ready.
  // If port 3000 is already in use (e.g. the developer is running `npm run zambdas:start`),
  // assume that server is the same code and reuse it instead of failing.
  await new Promise<void>((resolve, reject) => {
    const listener = app.listen(3000, () => {
      server = listener;
      console.log('Test server started on port 3000');
      resolve();
    });

    listener.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reusedExistingServer = true;
        console.log('Port 3000 already in use — reusing the existing zambda server for tests');
        resolve();
        return;
      }
      console.error('Server failed to start:', error);
      reject(error);
    });
  });

  project.provide('EXECUTE_ZAMBDA_URL', 'http://localhost:3000/local');

  // Return cleanup function to stop the server after all tests
  return async () => {
    if (server && !reusedExistingServer) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
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
