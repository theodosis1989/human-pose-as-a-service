import express from 'express';
import dotenv from 'dotenv';
import uploadUrlRoute from './routes/upload-url.js';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const origins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: origins.length ? origins : '*',
  methods: ['GET'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

app.use(express.json());
app.use('/upload-url', uploadUrlRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});