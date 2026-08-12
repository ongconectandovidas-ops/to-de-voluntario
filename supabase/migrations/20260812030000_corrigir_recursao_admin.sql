create or replace function public.eh_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.perfis where id = auth.uid() and tipo_conta = 'admin'
    );
$$;

grant execute on function public.eh_admin() to anon, authenticated;

drop policy if exists perfis_select_admin on public.perfis;
drop policy if exists voluntarios_select_admin on public.voluntarios;
drop policy if exists organizacoes_select_admin on public.organizacoes;
drop policy if exists oportunidades_select_admin on public.oportunidades;
drop policy if exists candidaturas_select_admin on public.candidaturas;
drop policy if exists doacoes_select_admin on public.doacoes;

create policy perfis_select_admin on public.perfis for select using (public.eh_admin());
create policy voluntarios_select_admin on public.voluntarios for select using (public.eh_admin());
create policy organizacoes_select_admin on public.organizacoes for select using (public.eh_admin());
create policy oportunidades_select_admin on public.oportunidades for select using (public.eh_admin());
create policy candidaturas_select_admin on public.candidaturas for select using (public.eh_admin());
create policy doacoes_select_admin on public.doacoes for select using (public.eh_admin());
