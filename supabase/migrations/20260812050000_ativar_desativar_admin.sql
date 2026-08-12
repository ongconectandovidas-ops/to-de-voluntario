alter table public.perfis add column if not exists ativo boolean not null default true;
alter table public.organizacoes add column if not exists ativo boolean not null default true;
alter table public.oportunidades add column if not exists ativo boolean not null default true;

drop policy if exists oportunidades_select_abertas_ou_proprias on public.oportunidades;
create policy oportunidades_select_abertas_ou_proprias on public.oportunidades
    for select using (
        (
            status = 'aberta'
            and ativo = true
            and organizacao_id in (select id from public.organizacoes where ativo = true)
        )
        or organizacao_id in (select id from public.organizacoes where responsavel_id = auth.uid())
    );

drop policy if exists perfis_update_admin on public.perfis
create policy perfis_update_admin on public.perfis
    for update using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists organizacoes_update_admin on public.organizacoes;
create policy organizacoes_update_admin on public.organizacoes
    for update using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists oportunidades_update_admin on public.oportunidades;
create policy oportunidades_update_admin on public.oportunidades
    for update using (public.eh_admin()) with check (public.eh_admin());
