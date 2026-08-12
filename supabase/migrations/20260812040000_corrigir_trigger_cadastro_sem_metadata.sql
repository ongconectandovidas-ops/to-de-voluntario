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
