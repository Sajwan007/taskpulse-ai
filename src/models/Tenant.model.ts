import mongoose, { Schema } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption';

/**
 * Multi-tenant model for TaskPulse AI
 * Each tenant represents a separate Slack workspace with their ClickUp integration
 */
const TenantSchema = new Schema({
  // Unique tenant identifier
  tenantId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `tenant_${crypto.randomUUID().slice(0, 8)}` 
  },
  
  // Organization info
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  
  // Subscription & billing
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'enterprise'],
    default: 'free'
  },
  billing: {
    email: String,
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid'],
      default: 'trialing'
    },
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  
  // Plan limits based on subscription
  limits: {
    maxUsers: { type: Number, default: 5 },
    maxWorkspaces: { type: Number, default: 1 },
    maxClickUpTeams: { type: Number, default: 1 },
    dailyDigestEnabled: { type: Boolean, default: true },
    aiSummariesPerDay: { type: Number, default: 100 },
    customBranding: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false }
  },
  
  // Usage tracking
  usage: {
    currentMonth: {
      aiSummaries: { type: Number, default: 0 },
      notifications: { type: Number, default: 0 },
      webhookEvents: { type: Number, default: 0 }
    },
    lastResetAt: { type: Date, default: Date.now }
  },
  
  // Slack workspace integration (one per tenant)
  slack: {
    teamId: { type: String, unique: true, sparse: true },
    teamName: String,
    teamDomain: String,
    // OAuth tokens (encrypted at rest)
    botToken: { type: String, set: encrypt, get: decrypt },
    botUserId: String,
    userToken: { type: String, set: encrypt, get: decrypt }, // For admin operations
    // Installation details
    installedBy: String,
    installedAt: { type: Date, default: Date.now },
    // Scopes granted
    scopes: [String]
  },
  
  // ClickUp workspace integration (one per tenant)
  clickup: {
    workspaceId: { type: String, unique: true, sparse: true },
    workspaceName: String,
    accessToken: { type: String, set: encrypt, get: decrypt },
    refreshToken: { type: String, set: encrypt, get: decrypt },
    tokenExpiry: Date,
    webhookId: String,
    webhookSecret: String,
    connectedAt: Date,
    connectedBy: String
  },
  
  // User mappings between Slack and ClickUp
  userMappings: [{
    slackUserId: String,
    slackEmail: String,
    slackUsername: String,
    clickupUserId: String,
    clickupEmail: String,
    clickupUsername: String,
    autoMapped: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    mappedAt: { type: Date, default: Date.now },
    lastSyncedAt: Date
  }],
  
  // Tenant-wide settings
  settings: {
    timezone: { type: String, default: 'UTC' },
    defaultDigestTime: { type: String, default: '09:00' },
    digestChannel: String, // Default Slack channel for team digests
    enableDMs: { type: Boolean, default: true },
    enableChannelNotifications: { type: Boolean, default: false },
    // Feature toggles
    features: {
      taskNotifications: { type: Boolean, default: true },
      commentSummaries: { type: Boolean, default: true },
      focusMode: { type: Boolean, default: true },
      dailyDigest: { type: Boolean, default: true },
      taskExplainer: { type: Boolean, default: true },
      priorityAlerts: { type: Boolean, default: true }
    },
    // Notification preferences
    notifications: {
      taskAssigned: { type: Boolean, default: true },
      taskComments: { type: Boolean, default: true },
      taskDueSoon: { type: Boolean, default: true },
      taskOverdue: { type: Boolean, default: true },
      dailyDigest: { type: Boolean, default: true }
    }
  },
  
  // Branding customization (for paid plans)
  branding: {
    logoUrl: String,
    brandColor: { type: String, default: '#4A154B' },
    customName: String,
    footerText: String
  },
  
  // Owner/admin user
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'trial_expired'],
    default: 'active'
  },
  
  // Metadata
  metadata: {
    source: { type: String, enum: ['oauth', 'manual', 'import'], default: 'oauth' },
    referrer: String,
    utmSource: String,
    utmCampaign: String
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  toJSON: { 
    getters: true,
    transform: function(doc, ret) {
      delete ret.slack?.botToken;
      delete ret.slack?.userToken;
      delete ret.clickup?.accessToken;
      delete ret.clickup?.refreshToken;
      return ret;
    }
  },
  toObject: { getters: true }
});

// Indexes for efficient queries
TenantSchema.index({ tenantId: 1 });
TenantSchema.index({ slug: 1 });
TenantSchema.index({ 'slack.teamId': 1 }, { unique: true, sparse: true });
TenantSchema.index({ 'clickup.workspaceId': 1 }, { unique: true, sparse: true });
TenantSchema.index({ 'billing.stripeCustomerId': 1 }, { sparse: true });
TenantSchema.index({ status: 1 });
TenantSchema.index({ plan: 1 });
TenantSchema.index({ ownerId: 1 });

// Middleware to update usage monthly
TenantSchema.pre('save', function(next) {
  if (this.isNew || this.usage.lastResetAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
    this.usage.currentMonth = {
      aiSummaries: 0,
      notifications: 0,
      webhookEvents: 0
    };
    this.usage.lastResetAt = new Date();
  }
  next();
});

// Static methods
TenantSchema.statics.getPlanLimits = function(plan: string) {
  const limits = {
    free: {
      maxUsers: 5,
      maxWorkspaces: 1,
      maxClickUpTeams: 1,
      dailyDigestEnabled: true,
      aiSummariesPerDay: 50,
      customBranding: false,
      prioritySupport: false
    },
    starter: {
      maxUsers: 15,
      maxWorkspaces: 2,
      maxClickUpTeams: 3,
      dailyDigestEnabled: true,
      aiSummariesPerDay: 500,
      customBranding: false,
      prioritySupport: false
    },
    pro: {
      maxUsers: 50,
      maxWorkspaces: 5,
      maxClickUpTeams: 10,
      dailyDigestEnabled: true,
      aiSummariesPerDay: 2000,
      customBranding: true,
      prioritySupport: true
    },
    enterprise: {
      maxUsers: -1, // Unlimited
      maxWorkspaces: -1,
      maxClickUpTeams: -1,
      dailyDigestEnabled: true,
      aiSummariesPerDay: -1,
      customBranding: true,
      prioritySupport: true
    }
  };
  return limits[plan] || limits.free;
};

// Instance methods
TenantSchema.methods.checkUsageLimit = function(feature: string, increment: number = 1) {
  const limits = TenantSchema.statics.getPlanLimits(this.plan);
  const key = feature === 'ai' ? 'aiSummaries' : feature;
  
  if (limits[key] === -1) return true; // Unlimited
  
  const currentUsage = this.usage.currentMonth[key] || 0;
  return currentUsage + increment <= limits[key];
};

TenantSchema.methods.incrementUsage = function(feature: string, amount: number = 1) {
  const key = feature === 'ai' ? 'aiSummaries' : feature;
  if (!this.usage.currentMonth[key]) {
    this.usage.currentMonth[key] = 0;
  }
  this.usage.currentMonth[key] += amount;
  return this.save();
};

TenantSchema.methods.findUserMapping = function(type: 'slack' | 'clickup', id: string) {
  return this.userMappings.find(mapping => {
    if (type === 'slack') {
      return mapping.slackUserId === id || mapping.slackEmail === id;
    } else {
      return mapping.clickupUserId === id || mapping.clickupEmail === id;
    }
  });
};

export const Tenant = mongoose.model('Tenant', TenantSchema);
