-- Bring-a-friend: participants can be added without their own device/login.
-- Brought friends carry the host's device token; manager-added rows are all-null.
alter table participants alter column participant_token drop not null;
alter table participants add column added_by_token text;
create index participants_added_by_idx on participants (session_id, added_by_token);
