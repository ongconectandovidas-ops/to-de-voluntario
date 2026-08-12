-- ========================================================================
-- TÔ DE VOLUNTÁRIO - ESTRUTURA COMPLETA DO BANCO (PostgreSQL)
-- -- ========================================================================

drop trigger if exists ao_criar_usuario on auth.users;
drop function if exists public.lidar_novo_usuario();

drop table if exists public.oportunidade_habilidades cascade;
drop table if exists public.candidaturas cascade;
drop table if exists public.doacoes cascade;
drop table if exists public.mensagens_contato cascade;
drop table if exists public.agendamentos cascade;
drop table if exists public.oportunidades cascade;
drop table if exists public.organizacoes cascade;
drop table if exists public.voluntarios cascade;
drop table if exists public.perfis cascade;
drop table if exists public.causas cascade;
drop table if exists public.habilidades cascade;

drop function if exists public.definir_atualizado_em();

create extension if not exists pgcrypto;


create function public.definir_atualizado_em()
returns trigger
language plpgsql
as $$
begin
    new.atualizado_em = now();
    return new;
end;
$$;


-- ========================================================================
-- 1. PERFIS
-- ========================================================================
create table public.perfis (
    id uuid primary key references auth.users (id) on delete cascade,
    tipo_conta text not null,
    nome text not null,
    sobrenome text,
    nome_social text,
    email text not null,
    telefone text,
    data_nascimento date,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),

    constraint perfis_email_unico unique (email),
    constraint perfis_tipo_conta_valido check (tipo_conta in ('voluntario', 'ong', 'doador'))
);

comment on table public.perfis is 'Dados básicos de qualquer usuário da plataforma (voluntário, ONG ou doador).';

create trigger perfis_atualizado_em
    before update on public.perfis
    for each row execute function public.definir_atualizado_em();

alter table public.perfis enable row level security;

create policy perfis_select_proprio on public.perfis
    for select using (auth.uid() = id);

create policy perfis_update_proprio on public.perfis
    for update using (auth.uid() = id);

create policy perfis_insert_proprio on public.perfis
    for insert with check (auth.uid() = id);


-- ========================================================================
-- 2. VOLUNTÁRIOS
-- ========================================================================
create table public.voluntarios (
    id uuid primary key references public.perfis (id) on delete cascade,
    genero text,
    pessoa_com_deficiencia boolean not null default false,
    dias_disponiveis text not null,
    periodo_atuacao text,
    formato_execucao text,
    cidade_atuacao text not null,
    estado_atuacao char(2),
    escolaridade text,
    profissao text,
    formacao_academica text,
    aceite_termos boolean not null default false,
    aceite_termos_em timestamptz,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),

    constraint voluntarios_genero_valido
        check (genero is null or genero in ('cisgenero', 'transgenero', 'nao_binario')),
    constraint voluntarios_dias_disponiveis_valido
        check (dias_disponiveis in ('segunda_a_sexta', 'fins_de_semana', 'todos_os_dias')),
    constraint voluntarios_periodo_atuacao_valido
        check (periodo_atuacao is null or periodo_atuacao in ('manha', 'tarde', 'noite')),
    constraint voluntarios_formato_execucao_valido
        check (formato_execucao is null or formato_execucao in ('presencial', 'virtual', 'hibrido')),
    constraint voluntarios_escolaridade_valida
        check (escolaridade is null or escolaridade in ('fundamental', 'medio', 'superior')),
    constraint voluntarios_aceite_termos_obrigatorio check (aceite_termos is true)
);

comment on table public.voluntarios is 'Dados de disponibilidade, formação e consentimento de quem se cadastrou como voluntário.';

create trigger voluntarios_atualizado_em
    before update on public.voluntarios
    for each row execute function public.definir_atualizado_em();

alter table public.voluntarios enable row level security;

create policy voluntarios_dono_gerencia on public.voluntarios
    for all using (auth.uid() = id) with check (auth.uid() = id);


-- ========================================================================
-- 3. ORGANIZAÇÕES (ONGs)
-- Cada organização é administrada por um perfil do tipo "ong".
-- ========================================================================
create table public.organizacoes (
    id uuid primary key default gen_random_uuid(),
    responsavel_id uuid not null references public.perfis (id) on delete cascade,
    nome_fantasia text not null,
    razao_social text,
    cnpj text,
    descricao text,
    cidade text,
    estado char(2),
    site text,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),

    constraint organizacoes_cnpj_unico unique (cnpj)
);

comment on table public.organizacoes is 'ONGs e instituições que publicam oportunidades de voluntariado.';

create trigger organizacoes_atualizado_em
    before update on public.organizacoes
    for each row execute function public.definir_atualizado_em();

create index organizacoes_responsavel_id_idx on public.organizacoes (responsavel_id);

alter table public.organizacoes enable row level security;

create policy organizacoes_select_publico on public.organizacoes
    for select using (true);

create policy organizacoes_dono_gerencia on public.organizacoes
    for all using (auth.uid() = responsavel_id) with check (auth.uid() = responsavel_id);


-- ========================================================================
-- 4 e 5. CAUSAS e HABILIDADES
-- Listas fixas usadas nos filtros de "Oportunidades" - tabela em vez de
-- texto livre, para evitar duplicidade ("Educação" vs "educacao").
-- ========================================================================
create table public.causas (
    id smallint generated always as identity primary key,
    nome text not null,

    constraint causas_nome_unico unique (nome)
);

comment on table public.causas is 'Categorias de causa social usadas para classificar oportunidades (lista fixa).';

create table public.habilidades (
    id smallint generated always as identity primary key,
    nome text not null,

    constraint habilidades_nome_unico unique (nome)
);

comment on table public.habilidades is 'Habilidades que uma oportunidade pode exigir do voluntário (lista fixa).';

alter table public.causas enable row level security;
alter table public.habilidades enable row level security;

create policy causas_select_publico on public.causas for select using (true);
create policy habilidades_select_publico on public.habilidades for select using (true);

insert into public.causas (nome) values
    ('Educação'), ('Animais'), ('Saúde'), ('Meio ambiente');

insert into public.habilidades (nome) values
    ('Comunicação'), ('Ensino'), ('Organização'), ('Cuidados');


-- ========================================================================
-- 6. OPORTUNIDADES
-- Vagas de voluntariado publicadas por uma organização.
-- ========================================================================
create table public.oportunidades (
    id uuid primary key default gen_random_uuid(),
    organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
    causa_id smallint not null references public.causas (id),
    titulo text not null,
    descricao text not null,
    cidade text,
    estado char(2),
    modalidade text not null,
    periodo text,
    dias_atuacao text,
    vagas_disponiveis integer not null default 1,
    status text not null default 'aberta',
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),

    constraint oportunidades_modalidade_valida check (modalidade in ('presencial', 'virtual', 'hibrido')),
    constraint oportunidades_periodo_valido
        check (periodo is null or periodo in ('manha', 'tarde', 'noite', 'integral')),
    constraint oportunidades_dias_atuacao_validos
        check (dias_atuacao is null or dias_atuacao in ('segunda_a_sexta', 'fins_de_semana', 'todos_os_dias')),
    constraint oportunidades_vagas_disponiveis_positivas check (vagas_disponiveis >= 0),
    constraint oportunidades_status_valido check (status in ('aberta', 'pausada', 'encerrada'))
);

comment on table public.oportunidades is 'Vagas de voluntariado publicadas por uma organização.';

create trigger oportunidades_atualizado_em
    before update on public.oportunidades
    for each row execute function public.definir_atualizado_em();

create index oportunidades_organizacao_id_idx on public.oportunidades (organizacao_id);
create index oportunidades_causa_id_idx on public.oportunidades (causa_id);
create index oportunidades_status_idx on public.oportunidades (status);

alter table public.oportunidades enable row level security;

create policy oportunidades_select_abertas_ou_proprias on public.oportunidades
    for select using (
        status = 'aberta'
        or organizacao_id in (select id from public.organizacoes where responsavel_id = auth.uid())
    );

create policy oportunidades_insert_dono on public.oportunidades
    for insert with check (
        organizacao_id in (select id from public.organizacoes where responsavel_id = auth.uid())
    );

create policy oportunidades_update_dono on public.oportunidades
    for update using (
        organizacao_id in (select id from public.organizacoes where responsavel_id = auth.uid())
    );

create policy oportunidades_delete_dono on public.oportunidades
    for delete using (
        organizacao_id in (select id from public.organizacoes where responsavel_id = auth.uid())
    );


-- ========================================================================
-- 7. OPORTUNIDADE_HABILIDADES (N:N entre oportunidades e habilidades)
-- ========================================================================
create table public.oportunidade_habilidades (
    oportunidade_id uuid not null references public.oportunidades (id) on delete cascade,
    habilidade_id smallint not null references public.habilidades (id) on delete cascade,

    constraint oportunidade_habilidades_pk primary key (oportunidade_id, habilidade_id)
);

comment on table public.oportunidade_habilidades is 'Quais habilidades cada oportunidade pede (relação N:N).';

alter table public.oportunidade_habilidades enable row level security;

create policy oportunidade_habilidades_select_publico on public.oportunidade_habilidades
    for select using (true);

create policy oportunidade_habilidades_gerencia_dono on public.oportunidade_habilidades
    for all
    using (oportunidade_id in (
        select o.id from public.oportunidades o
        join public.organizacoes g on g.id = o.organizacao_id
        where g.responsavel_id = auth.uid()
    ))
    with check (oportunidade_id in (
        select o.id from public.oportunidades o
        join public.organizacoes g on g.id = o.organizacao_id
        where g.responsavel_id = auth.uid()
    ));


-- ========================================================================
-- 8. CANDIDATURAS
-- Inscrição de um voluntário em uma oportunidade ("Participar").
-- ========================================================================
create table public.candidaturas (
    id uuid primary key default gen_random_uuid(),
    oportunidade_id uuid not null references public.oportunidades (id) on delete cascade,
    voluntario_id uuid not null references public.voluntarios (id) on delete cascade,
    mensagem text,
    status text not null default 'pendente',
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),

    constraint candidaturas_unica_por_oportunidade unique (oportunidade_id, voluntario_id),
    constraint candidaturas_status_valido
        check (status in ('pendente', 'aprovada', 'recusada', 'cancelada'))
);

comment on table public.candidaturas is 'Inscrição de um voluntário em uma oportunidade específica.';

create trigger candidaturas_atualizado_em
    before update on public.candidaturas
    for each row execute function public.definir_atualizado_em();

create index candidaturas_oportunidade_id_idx on public.candidaturas (oportunidade_id);
create index candidaturas_voluntario_id_idx on public.candidaturas (voluntario_id);

alter table public.candidaturas enable row level security;

create policy candidaturas_select_envolvidos on public.candidaturas
    for select using (
        voluntario_id = auth.uid()
        or oportunidade_id in (
            select o.id from public.oportunidades o
            join public.organizacoes g on g.id = o.organizacao_id
            where g.responsavel_id = auth.uid()
        )
    );

create policy candidaturas_insert_proprio_voluntario on public.candidaturas
    for insert with check (voluntario_id = auth.uid());

create policy candidaturas_update_envolvidos on public.candidaturas
    for update using (
        voluntario_id = auth.uid()
        or oportunidade_id in (
            select o.id from public.oportunidades o
            join public.organizacoes g on g.id = o.organizacao_id
            where g.responsavel_id = auth.uid()
        )
    );


-- ========================================================================
-- 9. DOAÇÕES
-- Cobre doação financeira e de itens; doador_id é opcional (doação anônima).
-- ========================================================================
create table public.doacoes (
    id uuid primary key default gen_random_uuid(),
    doador_id uuid references public.perfis (id) on delete set null,
    organizacao_id uuid references public.organizacoes (id) on delete set null,
    tipo text not null,
    valor numeric(10, 2),
    descricao_item text,
    metodo_pagamento text,
    status text not null default 'pendente',
    criado_em timestamptz not null default now(),

    constraint doacoes_tipo_valido check (tipo in ('financeira', 'item')),
    constraint doacoes_status_valido check (status in ('pendente', 'confirmada', 'cancelada')),
    constraint doacoes_valor_positivo check (valor is null or valor > 0),
    constraint doacoes_dados_conforme_tipo check (
        (tipo = 'financeira' and valor is not null)
        or (tipo = 'item' and descricao_item is not null)
    )
);

comment on table public.doacoes is 'Doações financeiras ou de itens, associadas ou não a uma organização.';

create index doacoes_doador_id_idx on public.doacoes (doador_id);
create index doacoes_organizacao_id_idx on public.doacoes (organizacao_id);

alter table public.doacoes enable row level security;

create policy doacoes_select_proprio_doador on public.doacoes
    for select using (doador_id = auth.uid());

create policy doacoes_insert_qualquer_pessoa on public.doacoes
    for insert with check (doador_id is null or doador_id = auth.uid());


-- ========================================================================
-- 10. MENSAGENS DE CONTATO
-- Formulário público de contato: qualquer visitante pode enviar; só a
-- organização (via service role) consegue ler as respostas.
-- ========================================================================
create table public.mensagens_contato (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    email text not null,
    assunto text not null,
    mensagem text not null,
    respondido_em timestamptz,
    criado_em timestamptz not null default now()
);

comment on table public.mensagens_contato is 'Mensagens enviadas pelo formulário público de contato.';

alter table public.mensagens_contato enable row level security;

create policy mensagens_contato_insert_publico on public.mensagens_contato
    for insert with check (true);


-- ========================================================================
-- 11. AGENDAMENTOS
-- Formulário de "Agende uma conversa" da página de Contato.
-- ========================================================================
create table public.agendamentos (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    email text not null,
    data_reuniao date not null,
    horario_reuniao time not null,
    motivo text,
    status text not null default 'pendente',
    criado_em timestamptz not null default now(),

    constraint agendamentos_status_valido check (status in ('pendente', 'confirmado', 'cancelado')),
    constraint agendamentos_horario_unico unique (data_reuniao, horario_reuniao, email)
);

comment on table public.agendamentos is 'Agendamentos de conversa marcados pelo formulário de Contato.';

alter table public.agendamentos enable row level security;

create policy agendamentos_insert_publico on public.agendamentos
    for insert with check (true);


-- ========================================================================
-- TRIGGER: cria perfil (e dados de voluntário) automaticamente no cadastro
--
-- Por que é necessário: o Supabase Auth, por padrão, exige confirmação de
-- e-mail. Isso significa que logo após auth.signUp() ainda NÃO existe uma
-- sessão ativa (auth.uid() é nulo), então um INSERT feito pelo front-end
-- (com a chave anon) seria barrado pelas policies de "perfis"/"voluntarios".
-- Um trigger com SECURITY DEFINER roda com privilégio elevado e resolve isso.
--
-- Os dados do formulário chegam via auth.signUp(..., { options: { data } }),
-- que o Supabase guarda em auth.users.raw_user_meta_data.
-- ========================================================================
create function public.lidar_novo_usuario()
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
        new.raw_user_meta_data ->> 'nome',
        new.raw_user_meta_data ->> 'sobrenome',
        new.raw_user_meta_data ->> 'nome_social',
        new.email,
        new.raw_user_meta_data ->> 'telefone',
        nullif(new.raw_user_meta_data ->> 'data_nascimento', '')::date
    );

    if tipo = 'voluntario' then
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
    end if;

    return new;
end;
$$;

create trigger ao_criar_usuario
    after insert on auth.users
    for each row execute function public.lidar_novo_usuario();
