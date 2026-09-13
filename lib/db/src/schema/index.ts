import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["owner", "admin", "member", "viewer", "ceo", "cto", "cmo"]);
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);
export const tagColorEnum = pgEnum("tag_color", ["purple", "yellow", "gray", "blue", "pink", "red"]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const workspacesTable = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWorkspaceSchema = createInsertSchema(workspacesTable).omit({ id: true, createdAt: true });
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspacesTable.$inferSelect;

// ─── Workspace Members ────────────────────────────────────────────────────────

export const workspaceMembersTable = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export type WorkspaceMember = typeof workspaceMembersTable.$inferSelect;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7C5AC2"),
  icon: text("icon"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  status: text("status").notNull().default("Em planejamento"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

// ─── Columns ──────────────────────────────────────────────────────────────────

export const columnsTable = pgTable("columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertColumnSchema = createInsertSchema(columnsTable).omit({ id: true, createdAt: true });
export type InsertColumn = z.infer<typeof insertColumnSchema>;
export type Column = typeof columnsTable.$inferSelect;

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasksTable = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  columnId: uuid("column_id").notNull().references(() => columnsTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  description: text("description"),
  priority: priorityEnum("priority").notNull().default("normal"),
  dueDate: timestamp("due_date"),
  estimatedHours: integer("estimated_hours"),
  coverImageUrl: text("cover_image_url"),
  position: integer("position").notNull().default(0),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

// ─── Task Assignees ───────────────────────────────────────────────────────────

export const taskAssigneesTable = pgTable("task_assignees", {
  id: serial("id").primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export type TaskAssignee = typeof taskAssigneesTable.$inferSelect;

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const tagsTable = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  color: tagColorEnum("color").notNull().default("gray"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTagSchema = createInsertSchema(tagsTable).omit({ id: true, createdAt: true });
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tagsTable.$inferSelect;

// ─── Task Tags ────────────────────────────────────────────────────────────────

export const taskTagsTable = pgTable("task_tags", {
  id: serial("id").primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tagsTable.id, { onDelete: "cascade" }),
});

export type TaskTag = typeof taskTagsTable.$inferSelect;

// ─── Subtasks ─────────────────────────────────────────────────────────────────

export const subtasksTable = pgTable("subtasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSubtaskSchema = createInsertSchema(subtasksTable).omit({ id: true, createdAt: true });
export type InsertSubtask = z.infer<typeof insertSubtaskSchema>;
export type Subtask = typeof subtasksTable.$inferSelect;

// ─── Comments ─────────────────────────────────────────────────────────────────

export const commentsTable = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;

// ─── Task Attachments ─────────────────────────────────────────────────────────

export const taskAttachmentsTable = pgTable("task_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"), // in bytes
  fileType: text("file_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TaskAttachment = typeof taskAttachmentsTable.$inferSelect;

// ─── Comment Likes ────────────────────────────────────────────────────────────

export const commentLikesTable = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: uuid("comment_id").notNull().references(() => commentsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  isLike: boolean("is_like").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CommentLike = typeof commentLikesTable.$inferSelect;

// ─── Activity Logs ────────────────────────────────────────────────────────────

export const activityLogsTable = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(), // e.g. "moved_to", "added_comment", "created", "changed_priority"
  metadata: text("metadata"), // JSON string with contextual data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;

// ─── Task Timers ──────────────────────────────────────────────────────────────

export const taskTimersTable = pgTable("task_timers", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  stoppedAt: timestamp("stopped_at"),
  durationSeconds: integer("duration_seconds"), // filled on stop
});

export type TaskTimer = typeof taskTimersTable.$inferSelect;

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const meetingsTable = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  color: text("color").notNull().default("purple"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;

// ─── Meeting Participants ──────────────────────────────────────────────────────

export const meetingParticipantsTable = pgTable("meeting_participants", {
  id: serial("id").primaryKey(),
  meetingId: uuid("meeting_id").notNull().references(() => meetingsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export type MeetingParticipant = typeof meetingParticipantsTable.$inferSelect;

// ─── Project Messages ─────────────────────────────────────────────────────────

export const projectMessagesTable = pgTable("project_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProjectMessage = typeof projectMessagesTable.$inferSelect;

// ─── Goals / OKRs ─────────────────────────────────────────────────────────────

export const goalsTable = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("objective"), // "objective" | "key_result"
  parentId: uuid("parent_id"), // self-reference for key results under objectives
  ownerId: uuid("owner_id").notNull().references(() => usersTable.id),
  targetValue: integer("target_value").default(100),
  currentValue: integer("current_value").default(0),
  unit: text("unit").default("%"), // "%", "R$", "un", etc.
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("active"), // "active" | "completed" | "cancelled"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(usersTable, ({ many }) => ({
  workspaceMembers: many(workspaceMembersTable),
  taskAssignees: many(taskAssigneesTable),
  comments: many(commentsTable),
  commentLikes: many(commentLikesTable),
  timers: many(taskTimersTable),
  meetingsCreated: many(meetingsTable),
  meetingParticipations: many(meetingParticipantsTable),
}));

export const workspacesRelations = relations(workspacesTable, ({ one, many }) => ({
  owner: one(usersTable, { fields: [workspacesTable.ownerId], references: [usersTable.id] }),
  members: many(workspaceMembersTable),
  projects: many(projectsTable),
  meetings: many(meetingsTable),
}));

export const projectsRelations = relations(projectsTable, ({ one, many }) => ({
  workspace: one(workspacesTable, { fields: [projectsTable.workspaceId], references: [workspacesTable.id] }),
  creator: one(usersTable, { fields: [projectsTable.createdBy], references: [usersTable.id] }),
  columns: many(columnsTable),
  tasks: many(tasksTable),
  tags: many(tagsTable),
  meetings: many(meetingsTable),
}));

export const columnsRelations = relations(columnsTable, ({ one, many }) => ({
  project: one(projectsTable, { fields: [columnsTable.projectId], references: [projectsTable.id] }),
  tasks: many(tasksTable),
}));

export const tasksRelations = relations(tasksTable, ({ one, many }) => ({
  column: one(columnsTable, { fields: [tasksTable.columnId], references: [columnsTable.id] }),
  project: one(projectsTable, { fields: [tasksTable.projectId], references: [projectsTable.id] }),
  creator: one(usersTable, { fields: [tasksTable.createdBy], references: [usersTable.id] }),
  assignees: many(taskAssigneesTable),
  tags: many(taskTagsTable),
  subtasks: many(subtasksTable),
  comments: many(commentsTable),
  activities: many(activityLogsTable),
  timers: many(taskTimersTable),
  attachments: many(taskAttachmentsTable),
}));

export const commentsRelations = relations(commentsTable, ({ one, many }) => ({
  task: one(tasksTable, { fields: [commentsTable.taskId], references: [tasksTable.id] }),
  user: one(usersTable, { fields: [commentsTable.userId], references: [usersTable.id] }),
  likes: many(commentLikesTable),
}));

export const commentLikesRelations = relations(commentLikesTable, ({ one }) => ({
  comment: one(commentsTable, { fields: [commentLikesTable.commentId], references: [commentsTable.id] }),
  user: one(usersTable, { fields: [commentLikesTable.userId], references: [usersTable.id] }),
}));

export const taskAttachmentsRelations = relations(taskAttachmentsTable, ({ one }) => ({
  task: one(tasksTable, { fields: [taskAttachmentsTable.taskId], references: [tasksTable.id] }),
  user: one(usersTable, { fields: [taskAttachmentsTable.userId], references: [usersTable.id] }),
}));

export const meetingsRelations = relations(meetingsTable, ({ one, many }) => ({
  workspace: one(workspacesTable, { fields: [meetingsTable.workspaceId], references: [workspacesTable.id] }),
  project: one(projectsTable, { fields: [meetingsTable.projectId], references: [projectsTable.id] }),
  creator: one(usersTable, { fields: [meetingsTable.createdBy], references: [usersTable.id] }),
  participants: many(meetingParticipantsTable),
}));

export const meetingParticipantsRelations = relations(meetingParticipantsTable, ({ one }) => ({
  meeting: one(meetingsTable, { fields: [meetingParticipantsTable.meetingId], references: [meetingsTable.id] }),
  user: one(usersTable, { fields: [meetingParticipantsTable.userId], references: [usersTable.id] }),
}));

export const goalsRelations = relations(goalsTable, ({ one, many }) => ({
  workspace: one(workspacesTable, { fields: [goalsTable.workspaceId], references: [workspacesTable.id] }),
  owner: one(usersTable, { fields: [goalsTable.ownerId], references: [usersTable.id] }),
  parent: one(goalsTable, { fields: [goalsTable.parentId], references: [goalsTable.id] }),
  keyResults: many(goalsTable, { relationName: "key_results" }),
}));

// ─── Financial Module ─────────────────────────────────────────────────────────

// ─── Financial Categories ─────────────────────────────────────────────────────

export const financialCategoriesTable = pgTable("financial_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7C5AC2"),
  type: text("type").notNull().default("both"), // 'inflow' | 'outflow' | 'both'
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFinancialCategorySchema = createInsertSchema(financialCategoriesTable).omit({ id: true, createdAt: true });
export type InsertFinancialCategory = z.infer<typeof insertFinancialCategorySchema>;
export type FinancialCategory = typeof financialCategoriesTable.$inferSelect;

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clientsTable = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  document: text("document"),       // CNPJ ou CPF
  email: text("email"),
  phone: text("phone"),
  status: text("status").notNull().default("active"), // 'active' | 'inactive'
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

// ─── Financial Accounts ───────────────────────────────────────────────────────

export const financialAccountsTable = pgTable("financial_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("checking"), // 'checking' | 'credit_card' | 'investment' | 'cash'
  color: text("color").notNull().default("#7C5AC2"),
  initialBalance: integer("initial_balance").notNull().default(0), // em centavos
  currentBalance: integer("current_balance").notNull().default(0), // em centavos
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialAccountSchema = createInsertSchema(financialAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialAccount = z.infer<typeof insertFinancialAccountSchema>;
export type FinancialAccount = typeof financialAccountsTable.$inferSelect;

// ─── Financial Approval Rules ────────────────────────────────────────────────

export const financialApprovalRulesTable = pgTable("financial_approval_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  maxAutoApprovalAmount: integer("max_auto_approval_amount").notNull().default(50000), // R$ 500,00 em centavos
  ceoThresholdAmount: integer("ceo_threshold_amount").notNull().default(300000), // R$ 3.000,00 em centavos
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FinancialApprovalRule = typeof financialApprovalRulesTable.$inferSelect;

// ─── Financial Budgets ───────────────────────────────────────────────────────

export const financialBudgetsTable = pgTable("financial_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  department: text("department").notNull(), // 'tech' | 'marketing' | 'operations' | 'general'
  categoryId: uuid("category_id").references(() => financialCategoriesTable.id, { onDelete: "cascade" }),
  month: integer("month").notNull(), // 1 - 12
  year: integer("year").notNull(),
  amount: integer("amount").notNull(), // teto em centavos
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialBudgetSchema = createInsertSchema(financialBudgetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialBudget = z.infer<typeof insertFinancialBudgetSchema>;
export type FinancialBudget = typeof financialBudgetsTable.$inferSelect;

// ─── Financial Settings ─────────────────────────────────────────────────────

export const financialSettingsTable = pgTable("financial_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  taxRatePercent: integer("tax_rate_percent").notNull().default(600), // 600 = 6.00% (basis points)
  emergencyReserveTarget: integer("emergency_reserve_target").notNull().default(5000000), // R$ 50.000,00 em centavos
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FinancialSettings = typeof financialSettingsTable.$inferSelect;

// ─── Financial Transactions ───────────────────────────────────────────────────

export const transactionTypeEnum = pgEnum("transaction_type", ["inflow", "outflow"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "paid", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["pix", "boleto", "credit_card", "bank_transfer", "cash"]);

export const financialTransactionsTable = pgTable("financial_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),

  // Core fields
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  description: text("description").notNull(),
  amount: integer("amount").notNull(), // Em centavos (R$ 1.500,00 = 150000)
  notes: text("notes"),               // Anotações internas dos sócios

  // Dates
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),

  // Payment & Bank Account
  paymentMethod: paymentMethodEnum("payment_method"),
  receiptUrl: text("receipt_url"), // URL do comprovante (via upload existente)
  accountId: uuid("account_id").references(() => financialAccountsTable.id, { onDelete: "set null" }),

  // Cost categorization & Partner attribution
  costType: text("cost_type").notNull().default("fixed_operating"), // 'direct_cogs' | 'fixed_operating' | 'partner_withdrawal' | 'tax' | 'investment'
  partnerId: uuid("partner_id").references(() => usersTable.id, { onDelete: "set null" }),

  // Governance & Approvals
  approvalStatus: text("approval_status").notNull().default("approved"), // 'not_required' | 'pending_approval' | 'approved' | 'rejected'
  approvedBy: uuid("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  // Reimbursements
  isReimbursement: boolean("is_reimbursement").notNull().default(false),
  reimbursementStatus: text("reimbursement_status"), // 'pending' | 'approved' | 'paid' | 'rejected'

  // Recurring & Installment tracking
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringInterval: text("recurring_interval"), // 'monthly' | 'quarterly' | 'yearly'
  installmentNumber: integer("installment_number"),  // Ex: 2 (de 5)
  installmentsTotal: integer("installments_total"),  // Ex: 5
  installmentGroupId: text("installment_group_id"),

  // Relations (all optional — allows standalone transactions)
  categoryId: uuid("category_id").references(() => financialCategoriesTable.id, { onDelete: "set null" }),
  clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type FinancialTransaction = typeof financialTransactionsTable.$inferSelect;

// ─── Financial Audit Logs ───────────────────────────────────────────────────

export const financialAuditLogsTable = pgTable("financial_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id").references(() => financialTransactionsTable.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(), // 'created' | 'updated' | 'status_changed' | 'approved' | 'rejected' | 'deleted'
  details: text("details"), // JSON com diff ou descrição
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FinancialAuditLog = typeof financialAuditLogsTable.$inferSelect;

// ─── Financial Relations ──────────────────────────────────────────────────────

export const financialAccountsRelations = relations(financialAccountsTable, ({ one, many }) => ({
  workspace: one(workspacesTable, { fields: [financialAccountsTable.workspaceId], references: [workspacesTable.id] }),
  transactions: many(financialTransactionsTable),
}));

export const financialCategoriesRelations = relations(financialCategoriesTable, ({ one, many }) => ({
  workspace: one(workspacesTable, { fields: [financialCategoriesTable.workspaceId], references: [workspacesTable.id] }),
  transactions: many(financialTransactionsTable),
  budgets: many(financialBudgetsTable),
}));

export const clientsRelations = relations(clientsTable, ({ one, many }) => ({
  workspace: one(workspacesTable, { fields: [clientsTable.workspaceId], references: [workspacesTable.id] }),
  transactions: many(financialTransactionsTable),
}));

export const financialTransactionsRelations = relations(financialTransactionsTable, ({ one, many }) => ({
  workspace: one(workspacesTable, { fields: [financialTransactionsTable.workspaceId], references: [workspacesTable.id] }),
  category: one(financialCategoriesTable, { fields: [financialTransactionsTable.categoryId], references: [financialCategoriesTable.id] }),
  client: one(clientsTable, { fields: [financialTransactionsTable.clientId], references: [clientsTable.id] }),
  project: one(projectsTable, { fields: [financialTransactionsTable.projectId], references: [projectsTable.id] }),
  account: one(financialAccountsTable, { fields: [financialTransactionsTable.accountId], references: [financialAccountsTable.id] }),
  partner: one(usersTable, { fields: [financialTransactionsTable.partnerId], references: [usersTable.id] }),
  approver: one(usersTable, { fields: [financialTransactionsTable.approvedBy], references: [usersTable.id] }),
  auditLogs: many(financialAuditLogsTable),
}));

export const financialAuditLogsRelations = relations(financialAuditLogsTable, ({ one }) => ({
  transaction: one(financialTransactionsTable, { fields: [financialAuditLogsTable.transactionId], references: [financialTransactionsTable.id] }),
  user: one(usersTable, { fields: [financialAuditLogsTable.userId], references: [usersTable.id] }),
}));