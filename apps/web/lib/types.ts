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

export interface Document {
  doc_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  uploaded_at: string;
}

export interface UploadResponse {
  doc_id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  status: string;
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
  | "mind_map";

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

export interface QuizDetailAnswer {
  question_index: number;
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
}

export interface QuizDetailResponse {
  id: string;
  topic: string;
  total_questions: number;
  score: number;
  answers: QuizDetailAnswer[];
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
  daily_signups: DailyCount[];
  daily_documents: DailyCount[];
  daily_active_users: DailyCount[];
  daily_tokens: DailyTokenTrend[];
  top_uploaders: TopUploader[];
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
  created_at: string;
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
}
