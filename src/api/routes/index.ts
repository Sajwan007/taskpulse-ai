import { Router } from 'express';
import webhookRoutes from './webhooks.routes';
import slackRoutes from './slack.routes';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'taskpulse-api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API information
router.get('/', (req, res) => {
  res.json({
    name: 'TaskPulse AI API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'AI-powered Slack bot for ClickUp task management',
    endpoints: {
      webhooks: '/webhooks',
      slack: '/slack',
      auth: '/auth',
      admin: '/api/admin'
    },
    documentation: '/docs',
    health: '/health'
  });
});

// Mount route modules
router.use('/webhooks', webhookRoutes);
router.use('/slack', slackRoutes);
router.use('/auth', authRoutes);
router.use('/api/admin', adminRoutes);

export default router;
