create unique index if not exists perfis_apenas_um_admin
    on public.perfis (tipo_conta)
    where tipo_conta = 'admin';
