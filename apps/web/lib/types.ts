export interface User {
  id: string;
  email: string;
  full_name: string;
  major?: string | null;
  is_pro?: boolean;
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

export interface UsageResponse {
  tokens_used_today: number;
  token_limit: number;
  tokens_remaining: number;
  is_pro: boolean;
  usage_by_type: Record<string, number>;
  reset_time: string;
}
