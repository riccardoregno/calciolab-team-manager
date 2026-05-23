-- CalcioLab — Stripe subscription columns required by webhook functions.
-- The webhook writes these fields after checkout/subscription events.

alter table public.teams
  add column if not exists subscription_status text default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

update public.teams
set subscription_status = coalesce(nullif(subscription_status, ''), billing_status, 'free')
where subscription_status is null or subscription_status = '';

create or replace function public.prevent_client_billing_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.subscription_plan is distinct from old.subscription_plan or
    new.subscription_status is distinct from old.subscription_status or
    new.billing_status is distinct from old.billing_status or
    new.trial_plan is distinct from old.trial_plan or
    new.trial_ends_at is distinct from old.trial_ends_at or
    new.trial_used is distinct from old.trial_used or
    new.stripe_customer_id is distinct from old.stripe_customer_id or
    new.stripe_subscription_id is distinct from old.stripe_subscription_id
  ) and auth.uid() is not null then
    raise exception
      'billing_immutable: subscription fields cannot be changed by the client (team: %)',
      old.id
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
