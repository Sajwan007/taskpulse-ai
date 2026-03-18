import mongoose, { Schema } from 'mongoose';

/**
 * Task cache model for storing ClickUp task data and AI-generated content
 * Improves performance by reducing API calls to ClickUp
 */
const TaskCacheSchema = new Schema({
  // Primary identifiers
  clickupTaskId: { type: String, required: true, unique: true },
  tenantId: { type: String, required: true, ref: 'Tenant' },
  
  // Basic task data from ClickUp
  name: { type: String, required: true },
  description: String,
  status: String,
  priority: {
    id: Number,
    priority: String,
    color: String
  },
  dueDate: Date,
  startDate: Date,
  estimatedTime: Number, // in minutes
  timeSpent: Number, // in minutes
  
  // Task relationships
  list: {
    id: String,
    name: String,
    spaceId: String,
    folderId: String
  },
  assignees: [{
    id: String,
    username: String,
    email: String
  }],
  creator: {
    id: String,
    username: String,
    email: String
  },
  tags: [{
    id: String,
    name: String,
    color: String
  }],
  customFields: [{
    id: String,
    name: String,
    type: String,
    value: Schema.Types.Mixed
  }],
  
  // URLs and references
  url: String,
  parent: String, // parent task ID if subtask
  dependencies: [String], // task IDs this task depends on
  
  // AI-generated content
  ai: {
    summary: String,
    keyPoints: [String],
    suggestedActions: [String],
    estimatedComplexity: {
      level: { type: String, enum: ['low', 'medium', 'high'] },
      confidence: Number,
      reasoning: String
    },
    lastSummarizedAt: Date,
    summaryVersion: { type: Number, default: 1 }
  },
  
  // Activity tracking
  activity: {
    commentsCount: { type: Number, default: 0 },
    lastCommentAt: Date,
    lastCommentId: String,
    attachmentsCount: { type: Number, default: 0 },
    timeTrackingEntries: { type: Number, default: 0 }
  },
  
  // Sync tracking
  sync: {
    lastSyncedAt: { type: Date, default: Date.now },
    clickupUpdatedAt: Date,
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'error'],
      default: 'synced'
    },
    syncError: String,
    retryCount: { type: Number, default: 0 }
  },
  
  // Notification tracking
  notifications: {
    assignmentSent: { type: Boolean, default: false },
    assignmentSentAt: Date,
    lastDigestIncluded: Date,
    priorityAlertsSent: [{ type: Date }],
    overdueNoticesSent: [{ type: Date }]
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['active', 'completed', 'archived', 'deleted'],
    default: 'active'
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
TaskCacheSchema.index({ clickupTaskId: 1 }, { unique: true });
TaskCacheSchema.index({ tenantId: 1 });
TaskCacheSchema.index({ 'list.id': 1 });
TaskCacheSchema.index({ assignees: 1 });
TaskCacheSchema.index({ dueDate: 1 });
TaskCacheSchema.index({ priority: 1 });
TaskCacheSchema.index({ status: 1 });
TaskCacheSchema.index({ 'sync.lastSyncedAt': 1 });
TaskCacheSchema.index({ 'ai.lastSummarizedAt': 1 });

// Compound indexes for common queries
TaskCacheSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
TaskCacheSchema.index({ tenantId: 1, 'assignees.id': 1, status: 1 });
TaskCacheSchema.index({ tenantId: 1, 'sync.syncStatus': 1 });

// Virtuals
TaskCacheSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.status === 'completed') return false;
  return new Date() > this.dueDate;
});

TaskCacheSchema.virtual('isDueSoon').get(function() {
  if (!this.dueDate || this.status === 'completed') return false;
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return this.dueDate <= twoDaysFromNow;
});

TaskCacheSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const now = new Date();
  const diffTime = this.dueDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
TaskCacheSchema.methods.needsResync = function(maxAgeMinutes: number = 5): boolean {
  const lastSync = this.sync.lastSyncedAt || this.createdAt;
  const maxAge = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return lastSync < maxAge;
};

TaskCacheSchema.methods.needsAISummary = function(maxAgeHours: number = 24): boolean {
  if (!this.ai.summary) return true;
  const lastSummary = this.ai.lastSummarizedAt || this.createdAt;
  const maxAge = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  return lastSummary < maxAge;
};

TaskCacheSchema.methods.updateFromClickUp = function(clickupTask: any) {
  this.name = clickupTask.name;
  this.description = clickupTask.description;
  this.status = clickupTask.status?.status;
  this.priority = clickupTask.priority;
  this.dueDate = clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)) : null;
  this.startDate = clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)) : null;
  this.assignees = clickupTask.assignees || [];
  this.creator = clickupTask.creator;
  this.tags = clickupTask.tags || [];
  this.customFields = clickupTask.custom_fields || [];
  this.url = clickupTask.url;
  this.parent = clickupTask.parent;
  this.sync.clickupUpdatedAt = new Date(clickupTask.date_updated);
  this.sync.lastSyncedAt = new Date();
  this.sync.syncStatus = 'synced';
  this.sync.syncError = null;
  this.sync.retryCount = 0;
  
  return this.save();
};

TaskCacheSchema.methods.addComment = function(commentData: any) {
  this.activity.commentsCount += 1;
  this.activity.lastCommentAt = new Date(commentData.date_created);
  this.activity.lastCommentId = commentData.id;
  return this.save();
};

TaskCacheSchema.methods.markAssignmentSent = function() {
  this.notifications.assignmentSent = true;
  this.notifications.assignmentSentAt = new Date();
  return this.save();
};

// Static methods
TaskCacheSchema.statics.findByTenant = function(tenantId: string, options: any = {}) {
  const query = this.find({ tenantId, status: 'active' });
  
  if (options.assigneeId) {
    query.where({ 'assignees.id': options.assigneeId });
  }
  
  if (options.listId) {
    query.where({ 'list.id': options.listId });
  }
  
  if (options.priority) {
    query.where({ 'priority.id': options.priority });
  }
  
  if (options.dueSoon) {
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    query.where({ 
      dueDate: { $exists: true, $lte: twoDaysFromNow },
      status: { $ne: 'completed' }
    });
  }
  
  if (options.overdue) {
    query.where({ 
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' }
    });
  }
  
  return query.sort({ dueDate: 1, priority: 1 });
};

TaskCacheSchema.statics.findStaleTasks = function(maxAgeMinutes: number = 5) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return this.find({
    'sync.lastSyncedAt': { $lt: cutoff },
    status: { $ne: 'deleted' }
  });
};

TaskCacheSchema.statics.findTasksNeedingAISummary = function(maxAgeHours: number = 24) {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  return this.find({
    $or: [
      { 'ai.lastSummarizedAt': { $lt: cutoff } },
      { 'ai.lastSummarizedAt': { $exists: false } }
    ],
    status: 'active'
  });
};

export const TaskCache = mongoose.model('TaskCache', TaskCacheSchema);
