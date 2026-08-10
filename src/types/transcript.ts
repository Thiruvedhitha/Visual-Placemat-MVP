import type { DiagramCommand } from "@/lib/commands";

export type TranscriptMode = "new_diagram" | "edit_diagram";

export type TranscriptStatus =
  | "uploaded"
  | "parsing"
  | "cleaning"
  | "filtering"
  | "extracting"
  | "resolving"
  | "ready_for_review"
  | "applying"
  | "completed"
  | "failed";

export interface MeetingTranscript {
  id: string;
  user_id: string;
  catalog_id: string | null;
  mode: TranscriptMode;
  title: string | null;
  meeting_date: string | null;
  raw_text: string;
  cleaned_text: string | null;
  context_prompt: string | null;
  summary: string | null;
  status: TranscriptStatus;
  progress: number;
  current_step: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface NodeProposalPayload {
  tempId: string;
  parentTempId: string | null;
  level: 0 | 1 | 2 | 3;
  name: string;
  description?: string;
}

export interface TodoProposalPayload {
  text: string;
  targetNodeId?: string | null;
  targetName?: string | null;
  priority: "low" | "medium" | "high";
  owner?: string | null;
  sourceQuote: string;
}

export type CommandProposalPayload = DiagramCommand & {
  rationale?: string;
  sourceQuote?: string;
  confidence?: number;
};

export type ProposalKind = "node" | "command" | "todo";
export type ProposalStatus = "pending" | "accepted" | "declined" | "applied" | "failed";

export interface TranscriptProposal {
  id: string;
  transcript_id: string;
  kind: ProposalKind;
  payload: NodeProposalPayload | CommandProposalPayload | TodoProposalPayload;
  confidence: number;
  source_quote: string | null;
  selected: boolean;
  status: ProposalStatus;
  apply_error: string | null;
  sort_order: number;
  created_at: string;
}

export interface TranscriptWithProposals {
  transcript: MeetingTranscript;
  proposals: {
    nodes: TranscriptProposal[];
    commands: TranscriptProposal[];
    todos: TranscriptProposal[];
  };
}

export interface SSEProgressEvent {
  progress: number;
  step: string;
}

export interface SSEDoneEvent {
  done: true;
}

export interface SSEErrorEvent {
  error: string;
}

export type SSEEvent = SSEProgressEvent | SSEDoneEvent | SSEErrorEvent;
