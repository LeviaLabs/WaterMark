# services/

Code that talks to outside tools and providers lives here, one folder per
integration (for example `supabase/`, `elevenlabs/`, `assistant/`). Pure logic
that does not call anything external belongs in `src/scripting/` instead.

Nothing is integrated on the landing-page branch yet. See `AGENTS.md` for the
rules on fetch requests and LLM tool calls before adding a service.
