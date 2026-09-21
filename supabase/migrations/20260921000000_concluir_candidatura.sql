-- Permite à ONG marcar uma candidatura aprovada como concluída, liberando
-- a emissão do certificado de participação para o voluntário.

alter table public.candidaturas drop constraint candidaturas_status_valido;

alter table public.candidaturas add constraint candidaturas_status_valido
    check (status in ('pendente', 'aprovada', 'recusada', 'cancelada', 'concluida'));
