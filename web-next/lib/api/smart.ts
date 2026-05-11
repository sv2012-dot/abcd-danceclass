// Smart ManchQ API client — typed wrappers around /api/smart/*
import api from './client';

// ── Types ─────────────────────────────────────────────────────────────────
export type SmartParsedEvent = {
  date: string;                     // YYYY-MM-DD
  time: string | null;              // HH:MM or null
  duration_min: number;
  batch_id: number | null;
  proposed_batch_name: string | null;
  type: 'Class' | 'Recital' | 'Rehearsal' | 'Workshop' | 'Other';
  confidence: 'high' | 'medium' | 'low';
  warning: string | null;
  source: string;
};

export type SmartParseResponse = {
  events: SmartParsedEvent[];
  year_assumed: number;
  warnings: string[];
};

export type SmartPlanTodo = {
  task_text: string;
  days_before_event: number;
  suggested_due_date: string;       // YYYY-MM-DD
  category:
    | 'Venue' | 'Costumes' | 'Music' | 'Communications'
    | 'Rehearsal' | 'Tech' | 'Day-of' | 'Other';
};

export type SmartPlanResponse = {
  todos: SmartPlanTodo[];
  summary: string;
};

export type SmartReplyContext = 'event' | 'recital' | 'batch' | 'student';
export type SmartReplyTone = 'friendly' | 'formal' | 'apologetic';

export type SmartReplyResponse = {
  message: string;
  char_count: number;
  suggested_send: 'whatsapp' | 'email';
  tone: SmartReplyTone;
  school_name: string;
};

// ── Endpoints ─────────────────────────────────────────────────────────────
export const smart = {
  parseEvents: (text: string) =>
    api.post('/smart/parse-events', { text }) as Promise<SmartParseResponse>,

  generateRecitalPlan: (recitalId: number) =>
    api.post('/smart/generate-recital-plan', { recital_id: recitalId }) as Promise<SmartPlanResponse>,

  draftMessage: (
    context: SmartReplyContext,
    contextId: number,
    purpose: string,
    tone: SmartReplyTone = 'friendly',
    custom?: string
  ) =>
    api.post('/smart/draft-message', {
      context,
      context_id: contextId,
      purpose,
      tone,
      custom,
    }) as Promise<SmartReplyResponse>,
};
