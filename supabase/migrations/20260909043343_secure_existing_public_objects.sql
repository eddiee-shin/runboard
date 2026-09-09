alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant select on public.app_sources to authenticated;
create policy "app_sources: 인증 사용자 조회"
  on public.app_sources for select
  to authenticated
  using (true);
