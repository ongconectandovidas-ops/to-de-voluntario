-- Recria perfis (e voluntario/organizacao) de contas do Auth que ficaram sem linha em public.perfis
-- (ex.: a migration 20260812000000 rodada de novo dropa as tabelas, mas auth.users continua).
-- Mesma regra do trigger lidar_novo_usuario. Idempotente: só pega quem não tem perfil.

insert into public.perfis (id, tipo_conta, nome, sobrenome, nome_social, email, telefone, data_nascimento)
select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'tipo_conta', 'voluntario'),
    coalesce(u.raw_user_meta_data ->> 'nome', split_part(u.email, '@', 1)),
    u.raw_user_meta_data ->> 'sobrenome',
    u.raw_user_meta_data ->> 'nome_social',
    u.email,
    u.raw_user_meta_data ->> 'telefone',
    nullif(u.raw_user_meta_data ->> 'data_nascimento', '')::date
from auth.users u
where not exists (select 1 from public.perfis p where p.id = u.id);

insert into public.voluntarios (
    id, genero, pessoa_com_deficiencia, dias_disponiveis, periodo_atuacao,
    formato_execucao, cidade_atuacao, escolaridade, profissao, formacao_academica,
    aceite_termos, aceite_termos_em
)
select
    u.id,
    nullif(u.raw_user_meta_data ->> 'genero', ''),
    coalesce((u.raw_user_meta_data ->> 'pessoa_com_deficiencia')::boolean, false),
    u.raw_user_meta_data ->> 'dias_disponiveis',
    nullif(u.raw_user_meta_data ->> 'periodo_atuacao', ''),
    nullif(u.raw_user_meta_data ->> 'formato_execucao', ''),
    u.raw_user_meta_data ->> 'cidade_atuacao',
    nullif(u.raw_user_meta_data ->> 'escolaridade', ''),
    nullif(u.raw_user_meta_data ->> 'profissao', ''),
    nullif(u.raw_user_meta_data ->> 'formacao_academica', ''),
    true,
    now()
from auth.users u
join public.perfis p on p.id = u.id and p.tipo_conta = 'voluntario'
where u.raw_user_meta_data ->> 'dias_disponiveis' is not null
    and u.raw_user_meta_data ->> 'cidade_atuacao' is not null
    and not exists (select 1 from public.voluntarios v where v.id = u.id);

insert into public.organizacoes (
    responsavel_id, nome_fantasia, razao_social, cnpj, descricao, cidade, estado, site
)
select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'nome_fantasia', u.raw_user_meta_data ->> 'nome'),
    nullif(u.raw_user_meta_data ->> 'razao_social', ''),
    nullif(u.raw_user_meta_data ->> 'cnpj', ''),
    nullif(u.raw_user_meta_data ->> 'descricao', ''),
    nullif(u.raw_user_meta_data ->> 'cidade', ''),
    nullif(u.raw_user_meta_data ->> 'estado', ''),
    nullif(u.raw_user_meta_data ->> 'site', '')
from auth.users u
join public.perfis p on p.id = u.id and p.tipo_conta = 'ong'
where coalesce(u.raw_user_meta_data ->> 'nome_fantasia', u.raw_user_meta_data ->> 'nome') is not null
    and not exists (select 1 from public.organizacoes o where o.responsavel_id = u.id);
