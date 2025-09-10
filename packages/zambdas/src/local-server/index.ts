import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import ottehrSpec from '../../../../config/oystehr/ottehr-spec.json';
import { expressLambda } from './utils';

const app = express();

app.use(express.text({ type: '*/*', limit: '6mb' }));

// Upgrade lower-cased authorization into capitalized one the way API Gateway does
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers.Authorization = req.headers.authorization;
  next();
});

app.use(cors());

Object.entries(ottehrSpec.zambdas).forEach(([_key, spec]) => {
  const executeOrExecutePublic = spec.type === 'http_auth' ? 'execute' : 'execute-public';
  const path = `/local/zambda/${spec.name}/${executeOrExecutePublic}`;
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

app.listen(3000, () => {
  console.log(`Zambda local server is running on port 3000`);
});

export default app;
