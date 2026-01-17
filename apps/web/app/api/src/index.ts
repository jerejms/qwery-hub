// Express.js main application entry point
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat';
import widgetsRouter from './routes/widgets';
import { settings } from './config/settings';

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: settings.CORS_ORIGINS || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-study-buddy-api',
  });
});

// Register routes
app.use('/chat', chatRouter);
app.use('/widgets', widgetsRouter);

// Start server
const PORT = settings.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 AI Study Buddy API running on http://localhost:${PORT}`);
  console.log(`📚 API docs available at http://localhost:${PORT}/health`);
});

export default app;
