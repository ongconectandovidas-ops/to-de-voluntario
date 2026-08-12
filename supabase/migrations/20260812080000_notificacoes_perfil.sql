alter table public.perfis
    add column if not exists notificacoes jsonb not null default '{"oportunidades": true, "campanhas": true, "emergenciais": false}'::jsonb;
