-- Cole este script no SQL Editor do Supabase (plano gratuito).

create table if not exists avaliacoes (
    id uuid primary key default gen_random_uuid(),
    nome text not null check (char_length(nome) between 2 and 60),
    nota int not null check (nota between 1 and 5),
    comentario text not null check (char_length(comentario) between 10 and 800),
    montagem jsonb not null default '{}'::jsonb,
    foto_url text,
    aprovado boolean not null default false,
    criado_em timestamptz not null default now()
);

alter table avaliacoes enable row level security;

-- Visitantes podem enviar avaliação, mas só leem as que você aprovou
create policy "enviar avaliacao" on avaliacoes
    for insert to anon
    with check (aprovado = false);

create policy "ler avaliacoes aprovadas" on avaliacoes
    for select to anon
    using (aprovado = true);

-- Bucket público para as fotos (leitura pública, envio anônimo)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "enviar foto" on storage.objects
    for insert to anon
    with check (bucket_id = 'fotos');

create policy "ler fotos" on storage.objects
    for select to anon
    using (bucket_id = 'fotos');
