alter table public.doacoes
    add column if not exists nome text,
    add column if not exists email text,
    add column if not exists telefone text;

update public.doacoes set nome = coalesce(nome, 'Não informado') where nome is null;
update public.doacoes set email = coalesce(email, 'nao-informado@email.com') where email is null;

alter table public.doacoes
    alter column nome set not null,
    alter column email set not null;
