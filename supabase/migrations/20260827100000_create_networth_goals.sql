-- Módulo Dashboard — pestaña Networth (CU-068) — docs/pdr/dashboard.md, docs/pdr/data-model-registry.md
--
-- Primera tabla nueva del módulo Dashboard: un único monto objetivo de Networth por usuario, sin
-- historial de metas anteriores (RN-254) — a diferencia de savings_goals/debts, `user_id` es la
-- propia primary key (no hay `id` propio): guardar una nueva meta es un upsert directo sobre la
-- única fila del usuario.

create table public.networth_goals (
  user_id uuid primary key references public.users (id) on delete cascade,
  monto_objetivo numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- VALIDATION_037: el monto de la meta debe ser mayor a cero.
  constraint networth_goals_monto_objetivo_positive check (monto_objetivo > 0)
);

create trigger networth_goals_set_updated_at
before update on public.networth_goals
for each row execute function public.set_updated_at();

alter table public.networth_goals enable row level security;

create policy "networth_goals_select_own" on public.networth_goals for select to authenticated
  using (auth.uid() = user_id);
create policy "networth_goals_insert_own" on public.networth_goals for insert to authenticated
  with check (auth.uid() = user_id);
create policy "networth_goals_update_own" on public.networth_goals for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Sin política de delete — no hay CU para eliminar la meta, solo cambiarla (upsert, CU-068).

-- ---------------------------------------------------------------------------
-- 2. clean_my_data() — se agrega el borrado de networth_goals al reinicio de cuenta
-- ---------------------------------------------------------------------------

create or replace function public.clean_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_001';
  end if;

  delete from public.networth_goals where user_id = v_user_id;
  delete from public.transactions where user_id = v_user_id;
  delete from public.budgets where user_id = v_user_id;
  delete from public.investment_balance_history where user_id = v_user_id;
  delete from public.debts where user_id = v_user_id;
  delete from public.savings_goals where user_id = v_user_id;
  delete from public.investments where user_id = v_user_id;
  delete from public.accounts where user_id = v_user_id;
  delete from public.categories where user_id = v_user_id;

  perform public.seed_default_categories_for_user(v_user_id);
end;
$$;

grant execute on function public.clean_my_data() to authenticated;
