drop policy if exists mensagens_contato_select_admin on public.mensagens_contato;
create policy mensagens_contato_select_admin on public.mensagens_contato
    for select using (public.eh_admin());

drop policy if exists mensagens_contato_update_admin on public.mensagens_contato;
create policy mensagens_contato_update_admin on public.mensagens_contato
    for update using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists agendamentos_select_admin on public.agendamentos;
create policy agendamentos_select_admin on public.agendamentos
    for select using (public.eh_admin());

drop policy if exists agendamentos_update_admin on public.agendamentos;
create policy agendamentos_update_admin on public.agendamentos
    for update using (public.eh_admin()) with check (public.eh_admin());
