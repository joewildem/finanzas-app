-- "Clean my data" (Settings) — reinicia la cuenta del usuario a un estado equivalente al de un
-- primer login: borra todo su contenido (transacciones, presupuesto, cuentas, categorías, metas
-- de ahorro, inversiones y deudas) y vuelve a sembrar las categorías por defecto. NUNCA toca
-- public.users (el renglón de allowlist / perfil) ni la sesión de auth.users — el usuario sigue
-- pudiendo iniciar sesión normalmente después.
--
-- La mayoría de estas tablas no conceden `delete` al rol `authenticated` (son solo-archivar por
-- diseño, ver notas de savings_goals/debts en data-model-registry.md) — esta función es
-- `security definer` a propósito para saltarse esa restricción de forma controlada, siempre
-- acotada a `auth.uid()`. El orden de los deletes respeta las foreign keys que no tienen
-- `on delete cascade` entre módulos (transactions -> categories/savings_goals/debts,
-- budgets -> savings_goals/debts).

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
