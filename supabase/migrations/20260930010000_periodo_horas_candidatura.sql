-- Período e carga horária da participação, informados pela ONG ao concluir a candidatura.
-- Alimentam o certificado (antes usava criado_em/atualizado_em, que não representam o período real).

alter table public.candidaturas
    add column if not exists data_inicio date,
    add column if not exists data_fim date,
    add column if not exists horas integer;

alter table public.candidaturas drop constraint if exists candidaturas_periodo_valido;
alter table public.candidaturas add constraint candidaturas_periodo_valido
    check (data_fim is null or data_inicio is null or data_fim >= data_inicio);

alter table public.candidaturas drop constraint if exists candidaturas_horas_validas;
alter table public.candidaturas add constraint candidaturas_horas_validas
    check (horas is null or horas > 0);

-- Concluídas antes desta migration: aproxima o período com as datas que já existiam.
-- "horas" fica nulo de propósito (não há como inferir); a ONG pode preencher depois.
update public.candidaturas
   set data_inicio = coalesce(data_inicio, criado_em::date),
       data_fim = coalesce(data_fim, atualizado_em::date)
 where status = 'concluida';

comment on column public.candidaturas.data_inicio is 'Primeiro dia de atuação do voluntário (informado pela ONG).';
comment on column public.candidaturas.data_fim is 'Último dia de atuação do voluntário (informado pela ONG).';
comment on column public.candidaturas.horas is 'Total de horas de trabalho voluntário (informado pela ONG).';
