import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import spinRouter from './routes/spin.routes';
import { scheduleDailyReset } from './jobs/reset';

const app = express();

app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(
  pinoHttp({
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    customProps: () => ({ service: 'festive-fare-spin' }),
  })
);

dayjs.extend(utc);
dayjs.extend(timezone);

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: dayjs().toISOString() });
});

app.use('/api/spin', spinRouter);

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Festive Fare Spin API listening on port ${port}`);
});

scheduleDailyReset();

export default app;
