export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
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

export interface ChatRequest {
  query: string;
  doc_id?: string;
  top_k?: number;
}

export interface ChatResponse {
  answer: string;
  context_sufficient: boolean;
  sources: Source[];
}

export interface SummaryRequest {
  topic: string;
  doc_id?: string;
  top_k?: number;
}

export interface SummaryResponse {
  summary: string;
  context_sufficient: boolean;
  sources: Source[];
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
  doc_id: string;
  query: string;
  answer: string;
  context_sufficient: boolean;
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
  doc_id: string;
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

export interface ApiError {
  detail: string;
}
