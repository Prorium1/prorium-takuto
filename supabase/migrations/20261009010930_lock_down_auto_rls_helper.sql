-- Supabase's optional automatic-RLS setting installs a SECURITY DEFINER
-- event-trigger helper in public. It does not need Data API execute access.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
