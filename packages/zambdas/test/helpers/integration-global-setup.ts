import { Server } from 'http';
import type { AddressInfo } from 'net';
import type { TestProject } from 'vitest/node';
import app from '../../src/local-server/index';

let server: Server | undefined;

/**
 * Starts a fresh integration-test zambda server on an OS-assigned free port so
 * the suite never depends on (or conflicts with) whatever the developer might
 * have running on port 3000. The chosen port is published to tests via the
 * `EXECUTE_ZAMBDA_URL` injected value.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const port = await new Promise<number>((resolve, reject) => {
    const listener = app.listen(0, () => {
      const address = listener.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to determine bound port for test server'));
        return;
      }
      server = listener;
      const boundPort = (address as AddressInfo).port;
      console.log(`Test zambda server started on port ${boundPort}`);
      resolve(boundPort);
    });
    listener.on('error', (error) => {
      console.error('Server failed to start:', error);
      reject(error);
    });
  });

  project.provide('EXECUTE_ZAMBDA_URL', `http://localhost:${port}/local`);

  // Return cleanup function to stop the server after all tests
  return async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          console.log('Test zambda server stopped');
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
