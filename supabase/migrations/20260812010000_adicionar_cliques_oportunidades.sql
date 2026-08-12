alter table public.oportunidades
    add column if not exists cliques integer not null default 0;

create index if not exists oportunidades_cliques_idx on public.oportunidades (cliques desc);

create or replace function public.incrementar_cliques_oportunidade(id_oportunidade uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.oportunidades
    set cliques = cliques + 1
    where id = id_oportunidade;
end;
$$;

grant execute on function public.incrementar_cliques_oportunidade(uuid) to anon, authenticated;
