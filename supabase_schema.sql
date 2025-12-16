-- =====================================================
-- Supertec Database Schema for Supabase
-- =====================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- =====================================================
-- PRODUCTOS TABLE
-- =====================================================
create table if not exists productos (
  id bigserial primary key,
  name text not null,
  description text not null default '',
  precio numeric(10, 2) not null default 0,
  categoria text not null default '',
  stock integer not null default 0,
  marca text not null default '',
  modelo text not null default '',
  img text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table productos enable row level security;

-- Public read policy
create policy "public can read productos"
on public.productos
for select to anon
using (true);

-- Authenticated users can insert/update/delete (for admin dashboard)
create policy "authenticated can insert productos"
on public.productos
for insert to authenticated
with check (true);

create policy "authenticated can update productos"
on public.productos
for update to authenticated
using (true);

create policy "authenticated can delete productos"
on public.productos
for delete to authenticated
using (true);

-- =====================================================
-- VENTAS TABLE
-- =====================================================
create table if not exists ventas (
  id bigserial primary key,
  name text not null,
  description text not null default '',
  precio numeric(10, 2) not null default 0,
  categoria text not null default '',
  stock integer not null default 0,
  marca text not null default '',
  modelo text not null default '',
  img text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table ventas enable row level security;

create policy "public can read ventas"
on public.ventas
for select to anon
using (true);

create policy "authenticated can insert ventas"
on public.ventas
for insert to authenticated
with check (true);

create policy "authenticated can update ventas"
on public.ventas
for update to authenticated
using (true);

create policy "authenticated can delete ventas"
on public.ventas
for delete to authenticated
using (true);

-- =====================================================
-- SERVICIOS TABLE
-- =====================================================
create table if not exists servicios (
  id bigserial primary key,
  name text not null,
  description text not null default '',
  precio numeric(10, 2) not null default 0,
  categoria text not null default '',
  stock integer not null default 0,
  marca text not null default '',
  modelo text not null default '',
  img text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table servicios enable row level security;

create policy "public can read servicios"
on public.servicios
for select to anon
using (true);

create policy "authenticated can insert servicios"
on public.servicios
for insert to authenticated
with check (true);

create policy "authenticated can update servicios"
on public.servicios
for update to authenticated
using (true);

create policy "authenticated can delete servicios"
on public.servicios
for delete to authenticated
using (true);

-- =====================================================
-- HORARIOS TABLE
-- =====================================================
create table if not exists horarios (
  id bigserial primary key,
  day text not null unique,
  open text not null default '',
  close text not null default '',
  closed boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table horarios enable row level security;

create policy "public can read horarios"
on public.horarios
for select to anon
using (true);

create policy "authenticated can update horarios"
on public.horarios
for update to authenticated
using (true);

-- Insert default horarios
insert into horarios (day, open, close, closed) values
  ('Lunes', '10:00', '18:00', false),
  ('Martes', '10:00', '18:00', false),
  ('Miércoles', '10:00', '18:00', false),
  ('Jueves', '10:00', '18:00', false),
  ('Viernes', '10:00', '18:00', false),
  ('Sábado', '', '', true),
  ('Domingo', '', '', true)
on conflict (day) do nothing;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_productos_updated_at before update on productos
  for each row execute procedure update_updated_at_column();

create trigger update_ventas_updated_at before update on ventas
  for each row execute procedure update_updated_at_column();

create trigger update_servicios_updated_at before update on servicios
  for each row execute procedure update_updated_at_column();

create trigger update_horarios_updated_at before update on horarios
  for each row execute procedure update_updated_at_column();

-- =====================================================
-- INDEXES for performance
-- =====================================================
create index if not exists idx_productos_categoria on productos(categoria);
create index if not exists idx_ventas_categoria on ventas(categoria);
create index if not exists idx_servicios_categoria on servicios(categoria);
create index if not exists idx_horarios_day on horarios(day);
