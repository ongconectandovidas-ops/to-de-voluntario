alter table public.perfis drop constraint if exists perfis_tipo_conta_valido;

alter table public.perfis add constraint perfis_tipo_conta_valido
    check (tipo_conta in ('voluntario', 'ong', 'doador', 'admin'));

create or replace function public.lidar_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    tipo text := coalesce(new.raw_user_meta_data ->> 'tipo_conta', 'voluntario');
begin
    insert into public.perfis (id, tipo_conta, nome, sobrenome, nome_social, email, telefone, data_nascimento)
    values (
        new.id,
        tipo,
        coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
        new.raw_user_meta_data ->> 'sobrenome',
        new.raw_user_meta_data ->> 'nome_social',
        new.email,
        new.raw_user_meta_data ->> 'telefone',
        nullif(new.raw_user_meta_data ->> 'data_nascimento', '')::date
    );

    if tipo = 'voluntario'
        and new.raw_user_meta_data ->> 'dias_disponiveis' is not null
        and new.raw_user_meta_data ->> 'cidade_atuacao' is not null
    then
        insert into public.voluntarios (
            id, genero, pessoa_com_deficiencia, dias_disponiveis, periodo_atuacao,
            formato_execucao, cidade_atuacao, escolaridade, profissao, formacao_academica,
            aceite_termos, aceite_termos_em
        )
        values (
            new.id,
            nullif(new.raw_user_meta_data ->> 'genero', ''),
            coalesce((new.raw_user_meta_data ->> 'pessoa_com_deficiencia')::boolean, false),
            new.raw_user_meta_data ->> 'dias_disponiveis',
            nullif(new.raw_user_meta_data ->> 'periodo_atuacao', ''),
            nullif(new.raw_user_meta_data ->> 'formato_execucao', ''),
            new.raw_user_meta_data ->> 'cidade_atuacao',
            nullif(new.raw_user_meta_data ->> 'escolaridade', ''),
            nullif(new.raw_user_meta_data ->> 'profissao', ''),
            nullif(new.raw_user_meta_data ->> 'formacao_academica', ''),
            true,
            now()
        );
    elsif tipo = 'ong'
        and coalesce(new.raw_user_meta_data ->> 'nome_fantasia', new.raw_user_meta_data ->> 'nome') is not null
    then
        insert into public.organizacoes (
            responsavel_id, nome_fantasia, razao_social, cnpj, descricao, cidade, estado, site
        )
        values (
            new.id,
            coalesce(new.raw_user_meta_data ->> 'nome_fantasia', new.raw_user_meta_data ->> 'nome'),
            nullif(new.raw_user_meta_data ->> 'razao_social', ''),
            nullif(new.raw_user_meta_data ->> 'cnpj', ''),
            nullif(new.raw_user_meta_data ->> 'descricao', ''),
            nullif(new.raw_user_meta_data ->> 'cidade', ''),
            nullif(new.raw_user_meta_data ->> 'estado', ''),
            nullif(new.raw_user_meta_data ->> 'site', '')
        );
    end if;

    return new;
end;
$$;

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
create policy perfis_select_admin on public.perfis
    for select using (public.eh_admin());

drop policy if exists voluntarios_select_admin on public.voluntarios;
create policy voluntarios_select_admin on public.voluntarios
    for select using (public.eh_admin());

drop policy if exists organizacoes_select_admin on public.organizacoes;
create policy organizacoes_select_admin on public.organizacoes
    for select using (public.eh_admin());

drop policy if exists oportunidades_select_admin on public.oportunidades;
create policy oportunidades_select_admin on public.oportunidades
    for select using (public.eh_admin());

drop policy if exists candidaturas_select_admin on public.candidaturas;
create policy candidaturas_select_admin on public.candidaturas
    for select using (public.eh_admin());

drop policy if exists doacoes_select_admin on public.doacoes;
create policy doacoes_select_admin on public.doacoes
    for select using (public.eh_admin());

drop policy if exists perfis_select_por_organizacao_dona on public.perfis;
create policy perfis_select_por_organizacao_dona on public.perfis
    for select using (
        id in (
            select c.voluntario_id
            from public.candidaturas c
            join public.oportunidades o on o.id = c.oportunidade_id
            join public.organizacoes g on g.id = o.organizacao_id
            where g.responsavel_id = auth.uid()
        )
    );

drop policy if exists voluntarios_select_por_organizacao_dona on public.voluntarios;
create policy voluntarios_select_por_organizacao_dona on public.voluntarios
    for select using (
        id in (
            select c.voluntario_id
            from public.candidaturas c
            join public.oportunidades o on o.id = c.oportunidade_id
            join public.organizacoes g on g.id = o.organizacao_id
            where g.responsavel_id = auth.uid()
        )
    );
