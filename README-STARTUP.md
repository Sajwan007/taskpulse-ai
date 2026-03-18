# 🚀 TaskPulse AI - Quick Start Guide

## For Absolute Beginners - Step by Step

This guide assumes you know NOTHING about coding. Follow each step exactly.

---

## 📋 What You'll Set Up

Your Computer                    Cloud Services
┌─────────────────┐             ┌─────────────────┐
│  VS Code        │             │  MongoDB Atlas  │ (Free database)
│  Node.js        │────────────▶│  Railway        │ (Free hosting)
│  Your Code      │             │  Sim AI         │ (AI workflows)
└─────────────────┘             └─────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
              ┌──────────┐                           ┌──────────┐
              │  Slack   │                           │ ClickUp  │
              │  (Bot)   │                           │ (Tasks)  │
              └──────────┘                           └──────────┘

---

## Step 1: Install Required Software (15 minutes)

### 1.1 Install Node.js
1. Go to https://nodejs.org
2. Click the green "LTS" button (recommended version)
3. Run the downloaded installer
4. Click "Next" through everything (use defaults)

**Verify it worked:**
- On Mac: Open Terminal (search in Spotlight)
- On Windows: Open Command Prompt (search in Start menu)
- Type: `node --version`
- You should see something like `v20.10.0` ✅

### 1.2 Install VS Code (Code Editor)
1. Go to https://code.visualstudio.com
2. Download for your operating system
3. Install and open it

### 1.3 Install Git
1. Go to https://git-scm.com/downloads
2. Download for your OS
3. Install with default settings

---

## Step 2: Create Your Project (10 minutes)

### 2.1 Create Project Folder
Open Terminal (Mac) or Command Prompt (Windows):

```bash
# Go to your Desktop
cd Desktop

# Create project folder
mkdir taskpulse-ai

# Go into the folder
cd taskpulse-ai

# Initialize the project
npm init -y
```

### 2.2 Install Dependencies
Copy and paste this entire command:

```bash
npm install express mongoose axios cors helmet morgan dotenv node-cron @slack/web-api
```

### 2.3 Open in VS Code
```bash
code .
```
This opens VS Code in your project folder.

---

## Step 3: Create Project Files (20 minutes)

### 3.1 Create File: `.env`
In VS Code:
1. Click File → New File
2. Save as `.env` (exactly this name, including the dot)
3. Paste this content:

```env
# Server
NODE_ENV=development
PORT=3000

# MongoDB (you'll fill this in Step5)
MONGODB_URI=paste_your_mongodb_uri_here

# ClickUp (you'll fill this in Step 6)
CLICKUP_API_TOKEN=paste_your_clickup_token_here

# Slack (you'll fill this in Step 7)
SLACK_BOT_TOKEN=paste_your_slack_token_here

# Sim AI (already set up!)
SIM_API_KEY=paste_your_sim_api_key_here
SIM_WORKFLOW_ID=a3952edb-db81-4452-a73d-359fbba2ba9a
```

### 3.2 Create File: `app.js`
Click File → New File
Save as `app.js`
The code is already provided in the project - it matches exactly what the guide needs!

### 3.3 Update `package.json`
The `package.json` is already updated to match the beginner guide with simple scripts.

---

## Step 4: Test Locally (2 minutes)

In your terminal, run:

```bash
npm start
```

You should see:

```
🚀 ================================
   TaskPulse AI is running!
================================
📍 Local: http://localhost:3000
❤️  Health: http://localhost:3000/health
```

Open your browser and go to: http://localhost:3000/health

You should see: `{"status":"✅ TaskPulse is running!"}` ✅

Press Ctrl+C to stop the server for now.

---

## Step 5: Set Up MongoDB (Free Database) - 10 minutes

### 5.1 Create Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free"
3. Sign up with Google or Email

### 5.2 Create Database
After signup, click "Build a Database"
- Choose "M0 FREE" (the free tier)
- Choose any cloud provider (AWS is fine)
- Choose a region close to you
- Click Create

### 5.3 Create User
- Enter username: `taskpulse`
- Click "Autogenerate Secure Password"
- **COPY THE PASSWORD** and save it somewhere!
- Click "Create User"

### 5.4 Allow Connections
- Scroll down to "Where would you like to connect from?"
- Click "Add My Current IP Address"
- Also click "Allow Access from Anywhere" (for when you deploy)
- Click "Finish and Close"

### 5.5 Get Connection String
- Click "Connect" on your cluster
- Choose "Connect your application"
- Copy the connection string
- It looks like: `mongodb+srv://taskpulse:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 5.6 Update Your `.env`
Replace `<password>` with your actual password and add `/taskpulse` before the `?`:

```env
MONGODB_URI=mongodb+srv://taskpulse:YourActualPassword@cluster0.xxxxx.mongodb.net/taskpulse?retryWrites=true&w=majority
```

---

## Step 6: Set Up ClickUp (5 minutes)

### 6.1 Get API Token
1. Open ClickUp (https://app.clickup.com)
2. Click your profile picture (bottom left)
3. Click "Settings"
4. Click "Apps" in the left sidebar
5. Scroll to "API Token"
6. Click "Generate" (or copy existing)
7. Copy the token

### 6.2 Update Your `.env`
```env
CLICKUP_API_TOKEN=pk_12345678_ABCDEFGHIJKLMNOP
```

---

## Step 7: Set Up Slack App (15 minutes)

### 7.1 Create Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. App Name: `TaskPulse AI`
5. Select your workspace
6. Click "Create App"

### 7.2 Add Bot Permissions
1. In left sidebar, click "OAuth & Permissions"
2. Scroll to "Scopes" → "Bot Token Scopes"
3. Click "Add an OAuth Scope" and add:
   - `chat:write`
   - `commands`
   - `users:read`

### 7.3 Install to Workspace
1. Scroll up and click "Install to Workspace"
2. Click "Allow"
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 7.4 Update Your `.env`
```env
SLACK_BOT_TOKEN=paste_your_slack_bot_token_here
```

### 7.5 Create Slash Commands (Do this AFTER deployment - Step9)
We'll add the Slack commands after deploying, because Slack needs a public URL.

---

## Step 8: Get Sim AI API Key (5 minutes)

### 8.1 Generate API Key
1. Go to Sim Studio (the same place where you're reading this!)
2. Look for Settings or API Keys section
3. Create a new API key
4. Copy it

### 8.2 Update Your `.env`
```env
SIM_API_KEY=your_sim_api_key_here
SIM_WORKFLOW_ID=a3952edb-db81-4452-a73d-359fbba2ba9a
```

---

## Step 9: Deploy to the Internet (15 minutes)

We'll use Railway - it's free and easy.

### 9.1 Push Code to GitHub
First, create a GitHub repository:

1. Go to https://github.com/new
2. Name it: `taskpulse-ai`
3. Keep it Private
4. Click "Create repository"

In your terminal:
```bash
# Initialize git
git init

# Create .gitignore to hide secrets
echo "node_modules/
.env" > .gitignore

# Add files
git add .

# Commit
git commit -m "Initial TaskPulse AI setup"

# Connect to GitHub (replace with YOUR username)
git remote add origin https://github.com/YOUR_USERNAME/taskpulse-ai.git

# Push
git branch -M main
git push -u origin main
```

### 9.2 Deploy on Railway
1. Go to https://railway.app
2. Click "Start a New Project"
3. Click "Deploy from GitHub repo"
4. Authorize Railway to access GitHub
5. Select your `taskpulse-ai` repository
6. Railway will detect Node.js automatically

### 9.3 Add Environment Variables
1. Click on your project in Railway
2. Go to "Variables" tab
3. Click "Raw Editor"
4. Paste your entire `.env` contents
5. Click "Update Variables"

### 9.4 Get Your Public URL
1. Go to "Settings" tab
2. Under "Domains", click "Generate Domain"
3. Copy your URL (like `https://taskpulse-ai-production.up.railway.app`)
4. Save this URL - you'll need it!

---

## Step 10: Connect Everything (10 minutes)

### 10.1 Update Slack App with Your URL
1. Go to https://api.slack.com/apps → Select your app

**Add Event Subscription:**
1. Click "Event Subscriptions" in left sidebar
2. Toggle Enable Events to ON
3. Request URL: `https://YOUR-RAILWAY-URL.railway.app/slack/events`
4. It should show ✅ Verified
5. Click "Save Changes"

**Add Slash Commands:**
1. Click "Slash Commands" in left sidebar
2. Click "Create New Command"

**Create /focus command:**
- Command: `/focus`
- Request URL: `https://YOUR-RAILWAY-URL.railway.app/slack/commands/focus`
- Description: Get your top priority tasks
- Click "Save"

**Create /task command:**
- Command: `/task`
- Request URL: `https://YOUR-RAILWAY-URL.railway.app/slack/commands/task`
- Description: Explain a task
- Usage Hint: `explain {task_id}`
- Click "Save"

### 10.2 Register ClickUp Webhook
In your terminal, run this command (replace the values):

```bash
curl -X POST "https://api.clickup.com/api/v2/team/YOUR_TEAM_ID/webhook" \
  -H "Authorization: YOUR_CLICKUP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://YOUR-RAILWAY-URL.railway.app/webhooks/clickup",
    "events": ["taskAssigneeUpdated", "taskCommentPosted", "taskUpdated"]
  }'
```

**To find your Team ID:**
1. Open ClickUp in browser
2. Look at URL: `https://app.clickup.com/12345678/...`
3. The number is your Team ID

### 10.3 Update Sim Workflow Variables
1. Go back to Sim Studio
2. Open the Task Assignment Notification workflow
3. Go to Settings or Environment Variables
4. Add:
   - `CLICKUP_API_TOKEN`: Your ClickUp token
   - `SLACK_BOT_TOKEN`: Your Slack bot token (xoxb-...)

---

## Step 11: Test It! 🎉

### Test 1: Health Check
Go to: `https://YOUR-RAILWAY-URL.railway.app/health`
Should show: `{"status":"✅ TaskPulse is running!"}`

### Test 2: Slack Commands
In Slack, type:
- `/focus` - Should respond with a message
- `/task explain test` - Should respond with a message

### Test 3: Task Assignment
1. Open ClickUp
2. Create a new task
3. Assign it to yourself
4. Wait 5-10 seconds
5. Check Slack - you should receive a notification! 🎉

---

## 🛠 Troubleshooting

### "Slack verification failed"
- Make sure URL ends with `/slack/events`
- Check Railway logs for errors
- Verify app is running

### "ClickUp webhook not working"
- Check Railway logs: `railway logs`
- Verify webhook URL is correct
- Make sure ClickUp token is valid

### "MongoDB connection failed"
- Check password doesn't have special characters
- Verify IP is allowed in MongoDB Atlas
- Check connection string format

### Check Logs
In Railway dashboard, click "Logs" to see what's happening.

---

## 📁 Final File Structure

```
taskpulse-ai/
├── app.js          ← Main application
├── package.json    ← Dependencies
├── .env            ← Your secrets (don't share!)
├── .gitignore      ← Tells git to ignore .env
└── node_modules/   ← Installed packages
```

---

## 🎯 What You've Built

| Feature | Status |
|---------|--------|
| Task Assignment Notifications | ✅ Working |
| /focus Command | 🟡 Basic (AI enhancement coming) |
| /task explain Command | 🟡 Basic (AI enhancement coming) |
| Daily Digest | 🔜 Next workflow to build |

---

## 🎉 Congratulations!

You've set up TaskPulse AI! Here's what you can do now:

1. **Assign tasks in ClickUp** → Get Slack notifications
2. **Type /focus in Slack** → See your priority tasks  
3. **Type /task explain {id}** → Get task explanations

### Next Steps

1. Create the Daily Digest workflow in Sim
2. Add more team members
3. Configure notification preferences
4. Set up the admin dashboard

---

## Quick Reference

| Service | URL |
|---------|-----|
| Your API | http://localhost:3000 (or production URL) |
| Slack Apps | https://api.slack.com/apps |
| ClickUp | https://app.clickup.com |
| MongoDB | https://cloud.mongodb.com |
| Sim Studio | https://sim.ai |
| Railway | https://railway.app |

| Command | What it does |
|---------|--------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server |
