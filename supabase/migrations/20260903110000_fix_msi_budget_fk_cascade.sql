-- Corrección de bug — supabase/migrations/20260903100000_add_msi_installments.sql
--
-- `budgets.msi_transaction_id` referencia `transactions(id)` sin `on delete cascade`. A diferencia
-- de `meta_id`/`deuda_id` (que referencian entidades sin baja física, solo archivado), una
-- transacción SÍ es eliminable (delete_transaction, CU-018) — borrar el gasto que originó un plan
-- MSI con un renglón ya guardado en `budgets` fallaría con una violación de llave foránea en vez de
-- limpiar ese renglón. `on delete cascade` es lo correcto aquí: si la transacción que da origen al
-- plan desaparece, el plan deja de existir, así que su renglón presupuestable no tiene sentido y debe
-- irse con ella (no puede quedar en null: violaría budgets_category_xor_meta_xor_deuda_xor_msi).

alter table public.budgets
  drop constraint budgets_msi_transaction_id_fkey;

alter table public.budgets
  add constraint budgets_msi_transaction_id_fkey
  foreign key (msi_transaction_id) references public.transactions (id) on delete cascade;
