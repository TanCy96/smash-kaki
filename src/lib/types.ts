export type Rsvp = "going" | "maybe" | "cant";
export type SessionStatus = "active" | "cancelled";

export interface Session {
  id: string;
  manage_token: string;
  guest_token: string;
  title: string;
  starts_at: string; // ISO
  duration_min: number;
  location: string;
  court_numbers: string | null;
  notes: string | null;
  status: SessionStatus;
  court_cost: number | null;
  shuttles_used: number | null;
  price_per_shuttle: number | null;
  created_at: string;
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
