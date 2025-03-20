import cors from 'cors';
import express from 'express';
import { index as versionHandler } from '../patient/version/index';
import { expressLambda } from './utils';

const app = express();

app.use(express.text({ type: '*/*', limit: '6mb' }));

app.use(cors());

// Version
app.get('/version', async (req, res) => {
  await expressLambda(versionHandler, req, res);
});

app.listen(3000, () => {
  console.log(`Zambda local server is running on port 3000`);
});

export default app;
