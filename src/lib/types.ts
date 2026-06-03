export type Rsvp = "going" | "maybe" | "cant";
export type SessionStatus = "active" | "cancelled";
export type SessionLifecycle = "draft" | "finalized";

export interface Session {
  id: string;
  manage_token: string;
  guest_token: string;
  title: string;
  starts_at: string | null; // ISO
  duration_min: number | null;
  location: string;
  court_numbers: string | null;
  notes: string | null;
  status: SessionStatus;
  lifecycle: SessionLifecycle;
  court_cost: number | null;
  shuttles_used: number | null;
  price_per_shuttle: number | null;
  created_at: string;
}

export interface SessionTimeOption {
  id: string;
  session_id: string;
  starts_at: string;
  duration_min: number;
  label: string | null;
  created_at: string;
}

export interface TimeOptionVote {
  id: string;
  session_id: string;
  session_time_option_id: string;
  name: string;
  participant_token: string;
  player_id: string | null;
  created_at: string;
}

export interface SessionTimeOptionWithVotes extends SessionTimeOption {
  votes: TimeOptionVote[];
}

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  rsvp: Rsvp;
  attended: boolean;
  participant_token: string;
  player_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}
