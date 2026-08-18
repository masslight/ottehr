import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import billingZambdasSpec from '../../../../config/billing-app-core/zambdas.json';
import zambdasSpec from '../../../../config/oystehr-core/zambdas.json';
import { expressLambda } from './utils';

const app = express();

app.use(express.text({ type: '*/*', limit: '6mb' }));

// Upgrade lower-cased authorization into capitalized one the way API Gateway does
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers.Authorization = req.headers.authorization;
  next();
});

app.use(cors());

// Register routes lazily to avoid Vite SSR import issues during module initialization
function registerRoutes(): void {
  // Local-only: point reports zambdas at another project's secrets (e.g. REPORTS_SECRETS=.env/urgikids-production.json)
  const reportsSecretsFile = process.env.REPORTS_SECRETS;
  Object.entries({ ...zambdasSpec.zambdas, ...billingZambdasSpec.zambdas }).forEach(([_key, spec]) => {
    const executeOrExecutePublic = spec.type === 'http_auth' ? 'execute' : 'execute-public';
    const path = `/local/zambda/${spec.name}/${executeOrExecutePublic}`;
    const isReportsZambda = spec.src.includes('/reports/');
    const secretsOverride = isReportsZambda && reportsSecretsFile ? { secretsFile: reportsSecretsFile } : undefined;
    app.post(path, async (req, res) => {
      const { index } = await import(`../../${spec.src}`);
      await expressLambda(index, req, res, secretsOverride);
    });
    app.head('/', async (req, res) => {
      res.send({
        status: 200,
      });
    });
    console.log(`Registered POST: ${path}${secretsOverride ? ` (override secrets: ${reportsSecretsFile})` : ''}`);
  });
}

// Register routes immediately (will be called by tests or when server starts)
registerRoutes();

// Only start the server if not in test environment
if (process.env.VITEST !== 'true') {
  // Port defaults to 3000; override with PORT so an ephemeral server (e.g. the
  // daily-census cron) can run on a dedicated port without colliding with the
  // interactive dev server on 3000.
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Zambda local server is running on port ${port}`);
  });
}

export default app;
