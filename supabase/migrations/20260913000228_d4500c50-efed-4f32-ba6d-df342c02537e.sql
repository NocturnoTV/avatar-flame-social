CREATE TABLE public.roblox_oauth_states (
  state TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  user_id UUID NOT NULL,
  return_to TEXT NOT NULL DEFAULT '/settings',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes'
);

GRANT ALL ON public.roblox_oauth_states TO service_role;
ALTER TABLE public.roblox_oauth_states ENABLE ROW LEVEL SECURITY;