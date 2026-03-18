import mongoose, { Schema } from 'mongoose';

/**
 * User model for individual users within tenants
 */
const UserSchema = new Schema({
  // Primary identifiers
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  
  // Tenant association
  tenantId: { 
    type: String, 
    required: true, 
    ref: 'Tenant'
  },
  
  // Role within tenant
  role: {
    type: String,
    enum: ['owner', 'admin', 'member', 'viewer'],
    default: 'member'
  },
  
  // Slack identity
  slack: {
    userId: String,
    username: String,
    teamId: String,
    realName: String,
    displayName: String,
    avatar: String,
    timezone: String,
    locale: String
  },
  
  // ClickUp identity
  clickup: {
    userId: String,
    username: String,
    email: String,
    role: String,
    avatar: String,
    timezone: String
  },
  
  // Individual preferences (can override tenant defaults)
  preferences: {
    digestEnabled: { type: Boolean, default: true },
    digestTime: { type: String, default: '09:00' },
    timezone: { type: String, default: 'UTC' },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '22:00' },
      end: { type: String, default: '08:00' }
    },
    notifications: {
      taskAssigned: { type: Boolean, default: true },
      taskComments: { type: Boolean, default: true },
      taskDueSoon: { type: Boolean, default: true },
      taskOverdue: { type: Boolean, default: true },
      dailyDigest: { type: Boolean, default: true },
      priorityAlerts: { type: Boolean, default: true }
    },
    focusMode: {
      enabled: { type: Boolean, default: true },
      maxTasks: { type: Number, default: 3 },
      includeOverdue: { type: Boolean, default: true },
      includeDueToday: { type: Boolean, default: true }
    }
  },
  
  // Authentication
  auth: {
    lastLoginAt: Date,
    loginCount: { type: Number, default: 0 },
    passwordHash: String, // For dashboard access
    resetToken: String,
    resetTokenExpiry: Date
  },
  
  // Activity tracking
  activity: {
    lastActiveAt: { type: Date, default: Date.now },
    totalInteractions: { type: Number, default: 0 },
    slackInteractions: { type: Number, default: 0 },
    taskViews: { type: Number, default: 0 }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Metadata
  metadata: {
    source: { type: String, enum: ['slack', 'clickup', 'manual'], default: 'slack' },
    invitedBy: String,
    joinedAt: { type: Date, default: Date.now }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.auth?.passwordHash;
      delete ret.auth?.resetToken;
      return ret;
    }
  }
});

// Indexes
UserSchema.index({ email: 1, tenantId: 1 }, { unique: true });
UserSchema.index({ tenantId: 1 });
UserSchema.index({ 'slack.userId': 1 }, { sparse: true });
UserSchema.index({ 'clickup.userId': 1 }, { sparse: true });
UserSchema.index({ status: 1 });
UserSchema.index({ role: 1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return this.name || this.slack?.realName || this.slack?.displayName || this.slack?.username;
});

// Instance methods
UserSchema.methods.canPerformAction = function(action: string): boolean {
  const permissions = {
    owner: ['*'],
    admin: ['manage_users', 'manage_integrations', 'view_analytics', 'manage_settings'],
    member: ['view_tasks', 'manage_own_preferences', 'use_slack_commands'],
    viewer: ['view_tasks', 'manage_own_preferences']
  };
  
  const userPermissions = permissions[this.role] || [];
  return userPermissions.includes('*') || userPermissions.includes(action);
};

UserSchema.methods.isInQuietHours = function(): boolean {
  if (!this.preferences.quietHours.enabled) return false;
  
  const now = new Date();
  const userTime = new Date(now.toLocaleString("en-US", {timeZone: this.preferences.timezone}));
  const currentHour = userTime.getHours();
  const startHour = parseInt(this.preferences.quietHours.start.split(':')[0]);
  const endHour = parseInt(this.preferences.quietHours.end.split(':')[0]);
  
  if (startHour > endHour) {
    // Overnight quiet hours (e.g., 22:00 to 08:00)
    return currentHour >= startHour || currentHour < endHour;
  } else {
    // Same day quiet hours (e.g., 01:00 to 06:00)
    return currentHour >= startHour && currentHour < endHour;
  }
};

UserSchema.methods.incrementActivity = function(type: 'slack' | 'task' | 'general') {
  this.activity.lastActiveAt = new Date();
  this.activity.totalInteractions += 1;
  
  if (type === 'slack') {
    this.activity.slackInteractions += 1;
  } else if (type === 'task') {
    this.activity.taskViews += 1;
  }
  
  return this.save();
};

// Static methods
UserSchema.statics.findBySlackId = function(slackUserId: string, tenantId: string) {
  return this.findOne({ 'slack.userId': slackUserId, tenantId });
};

UserSchema.statics.findByClickUpId = function(clickupUserId: string, tenantId: string) {
  return this.findOne({ 'clickup.userId': clickupUserId, tenantId });
};

UserSchema.statics.findByEmail = function(email: string, tenantId: string) {
  return this.findOne({ email: email.toLowerCase(), tenantId });
};

export const User = mongoose.model('User', UserSchema);
