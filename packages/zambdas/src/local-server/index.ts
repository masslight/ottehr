import cors from 'cors';
import express from 'express';
import ottehrSpec from '../../ottehr-spec.json';
import { expressLambda } from './utils';

const app = express();

app.use(express.text({ type: '*/*', limit: '6mb' }));

app.use(cors());

Object.entries(ottehrSpec.zambdas).forEach(([_key, spec]) => {
  console.log('spec', spec);
  app.post(`/${spec.name}`, async (req, res) => {
    const { index } = await import(`../../${spec.src}`);
    await expressLambda(index, req, res);
  });
});

app.listen(3000, () => {
  console.log(`Zambda local server is running on port 3000`);
});

export default app;
