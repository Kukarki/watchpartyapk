-- Optional: persist finished games for stats/history.
create table if not exists public.game_results (
  id         bigint generated always as identity primary key,
  session_id text not null,
  room_id    text,
  game_id    text not null,             -- wildbeam | matchblitz | ludo ...
  ranking    jsonb not null default '[]', -- [winnerUserId, second, ...]
  created_at timestamptz not null default now()
);
create index if not exists game_results_game_idx on public.game_results (game_id, created_at);
alter table public.game_results enable row level security;
create policy "results are public read" on public.game_results for select using (true);
