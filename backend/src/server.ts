import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import type definition extensions
import './types/express';

// Import routers
import saasRouter from './routes/saas.routes';
import userRouter from './routes/user.routes';
import checkinRouter from './routes/checkin.routes';
import posRouter from './routes/pos.routes';
import inventoryRouter from './routes/inventory.routes';
import analyticsRouter from './routes/analytics.routes';
import biometricRouter from './routes/biometric.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet());
app.use(cors());

// Logging
app.use(morgan('dev'));

// Body Parser
app.use(express.json());

// Basic health-check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'GymSaaS Backend API' });
});

// --- API Routes ---
app.use('/api/v1/saas', saasRouter);            // Sprint B3: SuperAdmin Panel
app.use('/api/v1/users', userRouter);            // Sprint B3: Member CRM (lifecycle completo)
app.use('/api/v1/checkin', checkinRouter);       // Sprint B4: Check-in & Gamification
app.use('/api/v1/pos', posRouter);               // Sprint B6/B7: POS, Expenses & Cash Shifts
app.use('/api/v1/inventory', inventoryRouter);   // Sprint B5: Control de Inventario
app.use('/api/v1/analytics', analyticsRouter);   // Sprint B8: Dashboard, Reportes y Auditoría
app.use('/biometric', biometricRouter);          // Sprint B9: IoT / Hardware endpoint (no JWT, x-api-key)

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]:', err.stack || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
