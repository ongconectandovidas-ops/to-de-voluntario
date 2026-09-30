-- Código curto de certificado (6 caracteres, sem 0/O/1/I) + validação pública.
-- O código é gerado pelo banco quando a candidatura vira "concluida" e nunca pode ser
-- escolhido/alterado pelo cliente (o trigger ignora o valor enviado).

alter table public.candidaturas add column if not exists codigo_certificado text;

create unique index if not exists candidaturas_codigo_certificado_key
    on public.candidaturas (codigo_certificado);

create or replace function public.gerar_codigo_certificado()
returns text
language plpgsql
as $$
declare
    alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    codigo text;
begin
    loop
        codigo := '';
        for i in 1..6 loop
            codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
        end loop;

        exit when not exists (select 1 from public.candidaturas where codigo_certificado = codigo);
    end loop;

    return codigo;
end;
$$;

create or replace function public.definir_codigo_certificado()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'concluida' then
        new.codigo_certificado := case when tg_op = 'UPDATE' then old.codigo_certificado else null end;
        new.codigo_certificado := coalesce(new.codigo_certificado, public.gerar_codigo_certificado());
    else
        new.codigo_certificado := case when tg_op = 'UPDATE' then old.codigo_certificado else null end;
    end if;

    return new;
end;
$$;

drop trigger if exists candidaturas_codigo_certificado on public.candidaturas;
create trigger candidaturas_codigo_certificado
    before insert or update on public.candidaturas
    for each row execute function public.definir_codigo_certificado();

-- Certificados já concluídos ganham código (o trigger gera no update).
update public.candidaturas set status = status where status = 'concluida' and codigo_certificado is null;

-- Validação pública: só devolve o que já está impresso no certificado.
drop function if exists public.validar_certificado(uuid);

create or replace function public.validar_certificado(p_codigo text)
returns table (nome text, oportunidade text, organizacao text, concluida_em timestamptz)
language sql
security definer
stable
set search_path = public
as $$
    select
        trim(coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')),
        o.titulo,
        g.nome_fantasia,
        c.atualizado_em
    from public.candidaturas c
    join public.oportunidades o on o.id = c.oportunidade_id
    join public.organizacoes g on g.id = o.organizacao_id
    join public.perfis p on p.id = c.voluntario_id
    where c.codigo_certificado = upper(trim(p_codigo)) and c.status = 'concluida';
$$;

grant execute on function public.validar_certificado(text) to anon, authenticated;
