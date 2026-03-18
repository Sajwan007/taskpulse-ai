// TaskPulse AI - Main Application
// Beginner-friendly version matching the startup guide
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());

// ============================================
// ROUTE 1: Health Check
// Test: http://localhost:3000/health
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: '✅ TaskPulse is running!',
    time: new Date().toISOString()
  });
});

// ============================================
// ROUTE 2: ClickUp Webhook Receiver
// ClickUp sends events here when tasks change
// ============================================
app.post('/webhooks/clickup', async (req, res) => {
  // Immediately tell ClickUp we received it
  res.json({ received: true });
  console.log('📥 Received ClickUp event:', req.body.event);
  
  const { event, task_id, history_items, webhook_id } = req.body;
  
  // When a task is assigned to someone
  if (event === 'taskAssigneeUpdated') {
    console.log('👤 Task assigned! Triggering Sim AI workflow...');
    try {
      // Call the Sim AI workflow we built
      const response = await fetch(
        `https://www.sim.ai/api/workflows/${process.env.SIM_WORKFLOW_ID}/run`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SIM_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event: event,
            task_id: task_id,
            webhook_id: webhook_id,
            history_items: history_items || []
          })
        }
      );
      const result = await response.json();
      console.log('✅ Sim workflow triggered!', result);
    } catch (error) {
      console.error('❌ Failed to trigger workflow:', error.message);
    }
  }
});

// ============================================
// ROUTE 3: Slack Command - /focus
// Shows your top priority tasks
// ============================================
app.post('/slack/commands/focus', (req, res) => {
  console.log('🎯 /focus command received from:', req.body.user_name);
  // Respond to Slack
  res.json({
    response_type: 'ephemeral', // Only visible to the user
    text: '🔍 *Analyzing your tasks...*\n\nThis feature is coming soon! The AI will analyze your ClickUp tasks and recommend what to focus on.'
  });
});

// ============================================
// ROUTE 4: Slack Command - /task explain
// Explains a task in simple terms
// ============================================
app.post('/slack/commands/task', (req, res) => {
  const text = req.body.text || '';
  console.log('📝 /task command received:', text);
  
  if (!text.includes('explain')) {
    return res.json({
      response_type: 'ephemeral',
      text: '📝 *Usage:* `/task explain abc123`\n\nReplace `abc123` with your ClickUp task ID.'
    });
  }
  
  res.json({
    response_type: 'ephemeral',
    text: '🔍 *Looking up task...*\n\nTask explainer coming soon!'
  });
});

// ============================================
// ROUTE 5: Slack Events (required by Slack)
// ============================================
app.post('/slack/events', (req, res) => {
  // Slack URL verification
  if (req.body.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }
  res.json({ ok: true });
});

// ============================================
// Start the Server
// ============================================
async function start() {
  try {
    // Connect to MongoDB
    if (process.env.MONGODB_URI && process.env.MONGODB_URI !== 'paste_your_mongodb_uri_here') {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    } else {
      console.log('⚠️  MongoDB not configured (optional for testing)');
    }
    
    // Start listening
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 ================================');
      console.log('   TaskPulse AI is running!');
      console.log('================================');
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`❤️  Health: http://localhost:${PORT}/health`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

start();
