import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { LOCAL_ZAMBDA_API_URL_ENV } from 'utils/lib/helpers/zambda-api-url-override';
import billingZambdasSpec from '../../../../config/billing-app-core/zambdas.json';
import zambdasSpec from '../../../../config/oystehr-core/zambdas.json';
import { expressLambda } from './utils';

const app = express();

// zambdas are served under this path, as the zambda API serves them under its /v1
const ZAMBDA_API_PATH = '/local';

// the base URL Oystehr clients use to call zambdas on the local server listening on `port`
export const localServerZambdaApiUrl = (port: number): string => `http://localhost:${port}${ZAMBDA_API_PATH}`;

app.use(express.text({ type: '*/*', limit: '6mb' }));

// Upgrade lower-cased authorization into capitalized one the way API Gateway does
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers.Authorization = req.headers.authorization;
  next();
});

app.use(cors());

// Register routes lazily to avoid Vite SSR import issues during module initialization
function registerRoutes(): void {
  Object.entries({ ...zambdasSpec.zambdas, ...billingZambdasSpec.zambdas }).forEach(([_key, spec]) => {
    const executeOrExecutePublic = spec.type === 'http_auth' ? 'execute' : 'execute-public';
    const path = `${ZAMBDA_API_PATH}/zambda/${spec.name}/${executeOrExecutePublic}`;
    app.post(path, async (req, res) => {
      const { index } = await import(`../../${spec.src}`);
      await expressLambda(index, req, res);
    });
    app.head('/', async (req, res) => {
      res.send({
        status: 200,
      });
    });
    console.log(`Registered POST: ${path}`);
  });
}

// Register routes immediately (will be called by tests or when server starts)
registerRoutes();

// Zambdas run here call other zambdas through the Oystehr clients, which read this to call this
// server instead of the deployed project.
export function routeZambdaCallsToLocalServer(port: number): void {
  process.env[LOCAL_ZAMBDA_API_URL_ENV] = localServerZambdaApiUrl(port);
}

// Only start the server if not in test environment
if (process.env.VITEST !== 'true') {
  // Port defaults to 3000; override with PORT so an ephemeral server (e.g. the
  // daily-census cron) can run on a dedicated port without colliding with the
  // interactive dev server on 3000.
  const port = Number(process.env.PORT) || 3000;
  routeZambdaCallsToLocalServer(port);
  app.listen(port, () => {
    console.log(`Zambda local server is running on port ${port}`);
  });
}

export default app;
