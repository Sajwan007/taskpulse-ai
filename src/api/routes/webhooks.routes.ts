import { Router } from 'express';
import { verifyClickUpWebhook } from '../middleware/webhook.verify';
import { resolveTenantFromClickUp } from '../middleware/tenant.middleware';
import * as WebhookController from '../controllers/webhook.controller';

const router = Router();

/**
 * ClickUp webhook endpoint
 * Handles all ClickUp events like task creation, updates, comments, etc.
 */
router.post('/clickup',
  verifyClickUpWebhook,
  resolveTenantFromClickUp,
  WebhookController.handleClickUpEvent
);

/**
 * Register a new webhook with ClickUp
 * Used during tenant setup to receive events
 */
router.post('/clickup/register', WebhookController.registerWebhook);

/**
 * Delete a webhook
 * Used when disconnecting ClickUp integration
 */
router.delete('/clickup/:webhookId', WebhookController.deleteWebhook);

/**
 * Test webhook endpoint
 * Used to verify webhook connectivity
 */
router.post('/clickup/test', (req, res) => {
  res.json({ 
    message: 'Webhook test received successfully',
    timestamp: new Date().toISOString(),
    body: req.body
  });
});

export default router;
