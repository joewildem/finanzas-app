-- Ajuste de regla de negocio en Presupuesto (CU-019) — el usuario debe poder dejar una categoría
-- presupuestada en $0 explícitamente (por ejemplo, para "pausarla" sin borrar el registro del mes),
-- distinto de vaciar el campo por completo (que sigue eliminando el presupuesto, RN-060). RN-057
-- pasa de "mayor a cero" a "mayor o igual a cero, nunca negativo" — ver docs/pdr/presupuesto.md.

alter table public.budgets drop constraint budgets_monto_positive;
alter table public.budgets add constraint budgets_monto_positive check (monto >= 0);

create or replace function public.save_budgets(p_mes text, p_items jsonb)
returns setof public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_category_id uuid;
  v_categoria_reservada text;
  v_monto numeric(14,2);
  v_category public.categories;
begin
  if auth.uid() is null then
    raise exception 'AUTH_001';
  end if;

  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'VALIDATION_017';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_category_id := nullif(v_item->>'category_id', '')::uuid;
    v_categoria_reservada := nullif(v_item->>'categoria_reservada', '');
    v_monto := nullif(v_item->>'monto', '')::numeric(14,2);

    if v_categoria_reservada is not null and v_categoria_reservada <> 'ahorros' then
      raise exception 'VALIDATION_019';
    end if;

    if v_category_id is not null then
      select * into v_category from public.categories
      where id = v_category_id and user_id = auth.uid() and tipo = 'categoria' and status = 'active';

      if not found then
        -- RN-058 alt.: categoría archivada/ajena/inexistente — se omite este ítem, no aborta el lote.
        continue;
      end if;
    end if;

    if v_monto is null then
      delete from public.budgets
      where user_id = auth.uid() and mes = p_mes
        and (
          (v_category_id is not null and category_id = v_category_id)
          or (v_categoria_reservada is not null and categoria_reservada = v_categoria_reservada)
        );
      continue;
    end if;

    if v_monto < 0 then
      raise exception 'VALIDATION_016';
    end if;

    if v_category_id is not null then
      insert into public.budgets (user_id, category_id, mes, monto)
      values (auth.uid(), v_category_id, p_mes, v_monto)
      on conflict (user_id, category_id, mes) where category_id is not null
      do update set monto = excluded.monto;
    else
      insert into public.budgets (user_id, categoria_reservada, mes, monto)
      values (auth.uid(), v_categoria_reservada, p_mes, v_monto)
      on conflict (user_id, categoria_reservada, mes) where categoria_reservada is not null
      do update set monto = excluded.monto;
    end if;
  end loop;

  return query select * from public.budgets where user_id = auth.uid() and mes = p_mes;
end;
$$;

revoke all on function public.save_budgets(text, jsonb) from public;
grant execute on function public.save_budgets(text, jsonb) to authenticated;
