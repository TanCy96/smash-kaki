-- Bring friends during a draft/poll: brought friends are votes owned by someone.
-- Owner is the host's device token (guest-brought) or the literal 'manager'.
alter table time_option_votes add column added_by_token text;
create index time_option_votes_added_by_idx
  on time_option_votes (session_id, added_by_token);
