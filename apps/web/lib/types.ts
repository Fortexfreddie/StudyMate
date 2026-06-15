export interface User {
  id: string;
  email: string;
  full_name: string;
  major?: string | null;
  is_pro?: boolean;
  role?: string;
  created_at: string;
}

export type PerformanceMode = "low" | "medium" | "high" | "very_high" | "max";

export interface UpdateProfileRequest {
  full_name?: string;
  major?: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SignupResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

// Ingestion lifecycle for an uploaded document. Parsing/embedding/indexing run
// in the background after upload, so a document is "processing" until its chunks
// are indexed ("ready") or ingestion fails ("failed").
export type DocumentStatus = "processing" | "ready" | "failed";

export interface Document {
  doc_id: string;
  filename: string;
  // null while still processing (counts are only known once parsing completes)
  page_count: number | null;
  chunk_count: number | null;
  status: DocumentStatus;
  error_message?: string | null;
  uploaded_at: string;
}

export interface UploadResponse {
  doc_id: string;
  filename: string;
  page_count: number | null;
  chunk_count: number | null;
  status: DocumentStatus;
}

export interface DocumentListResponse {
  documents: Document[];
}

export interface DeleteResponse {
  doc_id: string;
  deleted: boolean;
}

export interface Source {
  filename: string;
  page_number: number;
  similarity_score: number;
  text_preview: string;
}

export interface GenerationMeta {
  model_used: string;
  performance_mode: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached: boolean;
  retrieval_chunks_used: number;
}

export interface ChatRequest {
  query: string;
  doc_id?: string;
  top_k?: number;
}

export interface ChatResponse {
  answer: string;
  context_sufficient: boolean;
  sources: Source[];
  meta?: GenerationMeta;
}

export type SummaryFormat =
  | "bullets"
  | "key_concepts"
  | "study_guide"
  | "flashcards"
  | "cheat_sheet"
  | "mind_map"
  | "tabular";

export interface SummaryRequest {
  topic: string;
  doc_id?: string;
  top_k?: number;
  format?: SummaryFormat;
  full_document?: boolean;
}

// Structured sub-shapes — one per SummaryFormat. Mirror the backend schemas.
export interface ConceptItem {
  title: string;
  description: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface CheatSheetFormula {
  label: string;
  value: string;
}

export interface CheatSheetDefinition {
  term: string;
  meaning: string;
}

export interface CheatSheet {
  formulas: CheatSheetFormula[];
  definitions: CheatSheetDefinition[];
}

export interface MindMapBranch {
  label: string;
  children: string[];
}

export interface MindMap {
  root: string;
  branches: MindMapBranch[];
}

export interface StudyGuide {
  bullets: string[];
  concepts: ConceptItem[];
}

// `structured` is one of the per-format shapes (or null on a context gap / fallback).
// `format` tells the UI which shape to expect.
export type SummaryStructured =
  | string[]
  | ConceptItem[]
  | Flashcard[]
  | StudyGuide
  | CheatSheet
  | MindMap
  | null;

export interface SummaryResponse {
  summary: string;
  format: SummaryFormat;
  structured: SummaryStructured;
  context_sufficient: boolean;
  sources: Source[];
  meta?: GenerationMeta;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface QuizRequest {
  topic: string;
  doc_id?: string;
  num_questions?: number;
  top_k?: number;
}

export interface QuizResponse {
  session_id: string;
  topic: string;
  questions: QuizQuestion[];
  sources: Source[];
  meta?: GenerationMeta;
}

export interface QuizAnswer {
  question_index: number;
  selected_index: number;
}

export interface QuizSubmitRequest {
  answers: QuizAnswer[];
}

export interface QuizResult {
  question_index: number;
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
  explanation: string;
}

export interface QuizSubmitResponse {
  session_id: string;
  score: number;
  total_questions: number;
  results: QuizResult[];
}

export interface ChatHistoryItem {
  id: string;
  doc_id: string | null;
  query: string;
  answer: string;
  context_sufficient: boolean;
  sources: Source[];
  created_at: string;
}

export interface ChatHistoryResponse {
  messages: ChatHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface QuizHistoryItem {
  id: string;
  doc_id: string | null;
  topic: string;
  total_questions: number;
  score: number;
  created_at: string;
}

export interface QuizHistoryResponse {
  sessions: QuizHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SummaryHistoryItem {
  id: string;
  doc_id: string | null;
  topic: string;
  summary_text: string;
  format: SummaryFormat;
  context_sufficient: boolean;
  created_at: string;
}

export interface SummaryHistoryResponse {
  summaries: SummaryHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

// A single saved summary, fully renderable (mirrors SummaryResponse shape).
export interface SummaryDetailResponse {
  id: string;
  doc_id: string | null;
  topic: string;
  summary: string;
  format: SummaryFormat;
  structured: SummaryStructured;
  context_sufficient: boolean;
  sources: Source[];
  created_at: string;
}

export interface QuizDetailAnswer {
  question_index: number;
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
}

export interface QuizDetailResponse {
  id: string;
  doc_id?: string | null;
  topic: string;
  total_questions: number;
  score: number;
  answers: QuizDetailAnswer[];
  questions: QuizQuestion[];
  created_at: string;
}

export interface StatsResponse {
  documents_uploaded: number;
  quizzes_taken: number;
  summaries_generated: number;
  chats_count: number;
  current_streak: number;
  average_quiz_score: number;
  tokens_used_today: number;
  token_limit: number;
  is_pro: boolean;
}

export interface ApiError {
  detail: string;
}

// Admin — dashboard overview

export interface MajorBreakdown {
  major: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyTokenTrend {
  date: string;
  chat: number;
  summary: number;
  quiz: number;
}

export interface TopUploader {
  user_id: string;
  full_name: string;
  email: string;
  document_count: number;
  page_count: number;
}

export interface TopTokenUser {
  user_id: string;
  full_name: string;
  email: string;
  total_tokens: number;
  request_count: number;
}

export interface TopStreakUser {
  user_id: string;
  full_name: string;
  email: string;
  streak: number;
}

export interface RecentActivityItem {
  user_id: string;
  full_name: string;
  email: string;
  event_type: string; // "chat" | "summary" | "quiz" | "upload"
  doc_id: string | null;
  doc_filename: string | null;
  created_at: string;
}

export interface OnlineUser {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  last_seen_at: string;
}

export interface AdminOverview {
  total_users: number;
  total_admins: number;
  total_pro_users: number;
  users_by_role: Record<string, number>;
  users_by_major: MajorBreakdown[];
  active_users_today: number;
  active_users_7d: number;
  active_users_30d: number;
  total_documents: number;
  total_chunks: number;
  total_chats: number;
  total_summaries: number;
  total_quizzes: number;
  average_quiz_score: number;
  lifetime_tokens: number;
  tokens_today_logged: number;
  tokens_today_counter: number;
  tokens_by_type: Record<string, number>;
  tokens_by_model: Record<string, number>;
  lifetime_pages: number;
  pages_today_logged: number;
  pages_today_counter: number;
  daily_signups: DailyCount[];
  daily_documents: DailyCount[];
  daily_active_users: DailyCount[];
  daily_tokens: DailyTokenTrend[];
  daily_pages: DailyCount[];
  top_uploaders: TopUploader[];
  top_token_users: TopTokenUser[];
  top_streak_users: TopStreakUser[];
  online_users_count: number;
  recent_activity: RecentActivityItem[];
}

// Admin — user management

export interface AdminUserListItem {
  id: string;
  email: string;
  full_name: string;
  major?: string | null;
  is_pro: boolean;
  role: string;
  document_count: number;
  page_count: number;
  created_at: string;
  last_active: string | null; // ISO date (YYYY-MM-DD) or null if never active
  is_suspended: boolean;
  last_seen_at: string | null;
  is_online: boolean;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserUpdateRequest {
  is_pro?: boolean;
  role?: string;
  is_suspended?: boolean;
}

export interface AdminUserDeleteResponse {
  user_id: string;
  deleted: boolean;
}

export interface AdminUserListParams {
  search?: string;
  role?: string;
  major?: string;
  is_pro?: boolean;
  sort_by?: string;
  limit?: number;
  offset?: number;
}

// Admin — per-user token usage

export interface AdminUserUsageResponse {
  user_id: string;
  email: string;
  full_name: string;
  is_pro: boolean;
  role: string;
  start_date: string;
  end_date: string;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  tokens_by_type: Record<string, number>;
  tokens_by_model: Record<string, number>;
  total_pages: number;
  document_count: number;
  daily_tokens: DailyTokenTrend[];
  daily_pages: DailyCount[];
}

export interface AdminUserUsageParams {
  start?: string; // ISO date (YYYY-MM-DD)
  end?: string; // ISO date (YYYY-MM-DD)
  request_type?: "chat" | "summary" | "quiz";
}

// Admin — per-user profile detail (metadata only)

export interface AdminUserProfileResponse {
  user_id: string;
  email: string;
  full_name: string;
  major?: string | null;
  is_pro: boolean;
  role: string;
  created_at: string; // signup date
  last_active: string | null; // ISO date (YYYY-MM-DD)
  last_login_at: string | null;
  last_seen_at: string | null;
  is_online: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  current_streak: number;
  total_documents: number;
  total_pages: number;
  total_chunks: number;
  total_chats: number;
  total_summaries: number;
  total_quizzes: number;
  average_quiz_score: number; // 0–100
  summary_formats: Record<string, number>;
  performance_modes: Record<string, number>;
  tokens_by_model: Record<string, number>;
  lifetime_tokens: number;
  avg_generation_ms: Record<string, number>; // request_type -> avg ms
  avg_chunks_used: Record<string, number>; // request_type -> avg chunks
  cached_tokens_total: number;
}

// Admin — per-user audit trail (metadata only)

export interface AdminActivityItem {
  id: string;
  action_type: "chat" | "summary" | "quiz";
  created_at: string;
  doc_id: string | null;
  doc_filename: string | null;
  performance_mode: string | null;
  preview: string;
  summary_format: string | null; // summary format (e.g. "cheat_sheet"); null for chat/quiz
  score: number | null;
  total_questions: number | null;
}

export interface AdminUserActivityResponse {
  user_id: string;
  email: string;
  full_name: string;
  items: AdminActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserActivityParams {
  action_type?: "chat" | "summary" | "quiz";
  limit?: number;
  offset?: number;
}

// Admin — document management

export interface AdminDocumentListItem {
  doc_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  uploaded_at: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
}

export interface AdminDocumentListResponse {
  documents: AdminDocumentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminDocumentListParams {
  search?: string;
  sort_by?: string;
  limit?: number;
  offset?: number;
}

export interface UsageResponse {
  tokens_used_today: number;
  token_limit: number;
  tokens_remaining: number;
  is_pro: boolean;
  usage_by_type: Record<string, number>;
  reset_time: string;
  // Upload (page) quota — a separate daily dimension from tokens. Uploads consume
  // the embedding model, not the generation model. Resets at midnight UTC too.
  pages_used_today: number;
  page_limit: number;
  pages_remaining: number;
}

// Admin — presence & global activity feed

export interface AdminOnlineResponse {
  users: OnlineUser[];
  total: number;
  window_seconds: number;
}

export interface AdminRecentActivityResponse {
  items: RecentActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

// Leaderboard (admin + user-facing)

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  email: string | null;
  value: number;
  streak: number;
  total_tokens: number;
  badges: string[];
}

export interface LeaderboardResponse {
  metric: string; // "activity" | "tokens" | "streak"
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}
