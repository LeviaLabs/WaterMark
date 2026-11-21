# Sign-in, languages and voice: decision and integration contract

- Task: WM-CLAUDE-001
- Human owner: Decong
- Branch: `feat/decong-auth-i18n`
- Status: proposed for review. Nothing here is mounted in the app yet.
- Reviewers: Ryan Lin (app page), Ryan Bergman (landing page, chatbot, voice), Codex (Supabase)

## 1. Authentication decision

**Decision: no sign-in for the hackathon MVP.** Keep a ready-made, provider-neutral seam so
MojoAuth can be added when a feature needs accounts.

Why:

- Nothing in P0 needs an account. README section 8 and AGENTS.md put MojoAuth/SSOJet at P2 and
  require guest access. Saved places and notification preferences, the only features that
  need accounts, are not built yet.
- MojoAuth token checks need a server step. Its docs say tokens are RS256 JWTs to be verified
  on the backend; there is no Supabase Edge Function for that yet (Codex's area).
- A half-finished login on the demo is a risk with no user benefit.

**MojoAuth vs SSOJet.** If accounts are added, use MojoAuth.

| | MojoAuth | SSOJet |
| --- | --- | --- |
| Built for | Passwordless sign-in for end users (email magic link, OTP, passkeys) | Enterprise SSO (SAML/OIDC, SCIM) added to an existing B2B login |
| Fits residents, schools, CERT volunteers | Yes: no passwords, works with any email | No: users would need a company identity provider |
| Pricing model | Has a free tier (confirm current limits) | Per enterprise connection |
| Token check | RS256 JWT, verified server-side with MojoAuth SDKs | Not evaluated further |

Open points before building MojoAuth (verify in MojoAuth's docs and dashboard):

- The React guide (`mojoauth-web-sdk`) puts the "API key" in browser code but does not say the
  key is safe to expose. Confirm it is a public key and restrict allowed origins before use.
- The JWKS URL, issuer and audience claims are not on the token page we read. Get them from the
  SDK docs or dashboard before writing verification.
- Do not store the MojoAuth access token in `localStorage`. Send it once to the verification
  function and keep only the returned account fields.

## 2. What this branch adds

All new code is under `WaterMark/src/`, in new folders. No existing file was changed except one
line in `WaterMark/package.json` (adds `npm test`).

| Path | What it is |
| --- | --- |
| `src/i18n/locales.ts` | Supported languages: English, Spanish, Chinese (Simplified), Russian, Hindi (pending) |
| `src/i18n/messages/*.ts` | Dictionaries. Types force every language to have every key |
| `src/i18n/core.ts` | Pure helpers: locale matching and detection, `translate`, number, measurement and date formatting |
| `src/i18n/I18nProvider.tsx` | React provider; sets `<html lang>`/`dir`, saves choice, emits locale-change event |
| `src/i18n/useI18n.ts` | Hook: `t`, `formatNumber`, `formatMeasurement`, `formatDateTime`, `languageName`, `setLocale` |
| `src/i18n/LanguageSelect.tsx` | Accessible language picker |
| `src/i18n/OfficialText.tsx` | Shows official warning text verbatim, with an optional translation labeled unofficial |
| `src/auth/*` | Optional sign-in seam: `AuthProvider`, `useAuth`, `AuthStatus`, `RequireAccount`, guest adapter, pure session rules |
| `src/voice/contract.ts` | Types and helpers shared with the voice assistant. Not a voice client |
| `*.test.ts` | 40 unit tests run by `npm test` (Node's built-in test runner, no new dependency) |

## 3. Integration instructions

### Ryan Bergman: app entry (`main.tsx` or `App.tsx`)

Wrap the app once. `AuthProvider` with no `adapter` prop is guest-only and renders children
immediately, so it cannot block the page.

```tsx
import { I18nProvider } from './i18n/I18nProvider.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
```

Put `<LanguageSelect />` in the landing header. Add `<AuthStatus />` only when sign-in is
enabled; until then it just says "Browsing as a guest".

### Ryan Lin: app page, panel and alerts

- Use `const { t, formatMeasurement, formatDateTime } = useI18n()` for interface text, values and
  times. Add new strings to `src/i18n/messages/en.ts` first; the type check then lists the keys
  every other language is missing.
- Values: `formatMeasurement(value, unit)` keeps the source unit and shows "Unknown" for
  missing data, never 0.
- Times: `<time dateTime={iso}>{formatDateTime(iso, 'America/New_York')}</time>` keeps the
  source timestamp in the markup and shows the zone.
- Official alerts: render with `<OfficialText text={...} sourceName="National Weather Service"
  sourceLanguage="en" sourceUrl={...} issuedAt={...} />`. Do not pass alert text through `t()`.
- Put `<LanguageSelect hideLabel />` in the map toolbar if there is room. It keeps a
  screen-reader label.
- Only wrap account features in `<RequireAccount feature="savedPlaces">`. Never wrap the map.

### Codex: Supabase

- Please confirm or change: every provider text field in API responses carries
  `sourceLanguage` (BCP 47). The backend never machine-translates official text.
- For MojoAuth later: a verification Edge Function (proposed name `auth-verify`) that takes the
  MojoAuth token, verifies it server-side, and returns
  `{ id, displayName, expiresAt }`. The client adapter will pass that through `sanitizeState`.
  Profile and saved-place tables need RLS.

## 4. Language and voice contract (Ryan Bergman)

Answers to the five questions in WM-CLAUDE-001:

1. **Languages the voice provider supports.** ElevenLabs' language page (checked 2026-11-21)
   lists English, Spanish, Chinese, Russian and Hindi for Multilingual v2, Flash v2.5 and
   Eleven v3. We have not heard any of them in WaterMark's flow yet, so all are marked
   `listed-untested` in `src/voice/contract.ts` and `canSpeak` is false.
2. **Can it read localized text?** Yes, these models take text in the target language. The
   assistant should produce its explanation in the selected locale.
3. **How the locale reaches voice.** `useI18n().locale` in React, or listen on `window` for
   `watermark:localechange`. Its detail is `{ locale, voice: { voiceLanguage, support, canSpeak } }`.
   `zh-Hans` maps to provider code `zh`.
4. **Unsupported or untested language.** Do not fall back to English speech silently. Show
   `t('voice.unavailable', { language })` and keep everything on screen. Warnings never depend on
   audio.
5. **Numbers, place names and warning names.** Send speech as typed segments (`SpeechSegment`):
   - `explanation`: WaterMark's own localized words.
   - `measurement`: `value` and `unit` as on screen plus `spoken`, written out in the locale.
     Speech must match the screen.
   - `place`: spoken as written, not translated.
   - `official-quote`: NWS event names and alert text, with `sourceLanguage`. Read in the
     source language, or say that an official warning is shown on screen. Never paraphrase.

Ryan B implements `SpeechSink { speak(request), cancel() }` inside his voice module. I will not
edit voice components without his approval. After testing a language end to end, change its
entry to `support: 'tested'`.

## 5. Translation rules

- Interface text only. Official warnings are shown as issued, in their language, with source,
  issue time and link. Translations, if any, are labeled "Unofficial translation" and placed
  after the original.
- Numbers, units, times, place names and agency names stay as the source gives them.
- "No data" and "no active alerts" always say that this does not mean safe.
- Non-English strings were drafted with AI assistance and need native-speaker review before the
  demo. Hindi is a candidate; the team still needs to confirm which Indian language(s) to use.

## 6. Accessibility in these components

- Native `<select>` with a real `<label>` (visible by default; `hideLabel` keeps it for screen
  readers); each option has its own `lang` so names are pronounced correctly.
- `<html lang>` follows the selected language. Official text carries its own `lang`.
- Visible focus outline on picker, auth buttons and source links; 44 px touch target.
- Sign-in status uses `role="status"` with `aria-live="polite"`; the sign-in button sets
  `aria-busy` while loading. Error and expired messages say the map still works.
- Checked in a browser at 375 px width: no horizontal scroll.

Not covered here (owned by Ryan Lin/Ryan B): keyboard support for map tabs and the draggable
panel, dialogs, and page-level loading states. I can review them when those pages exist.

## 7. Tests

`cd WaterMark && npm test` runs 40 tests:

- Every language has exactly the English keys and the same `{placeholders}`; no markup in strings.
- Locale matching, including Traditional Chinese not getting Simplified text, and junk input.
- Fallback to English, visible missing variables, plain-text variable insertion.
- Units kept verbatim; missing values show "Unknown", never 0; dates include the time zone.
- Access control: public features (map, alerts, forecasts, sources, search, voice) work in every
  auth state; account features need a live session; expired sessions do not unlock.
- Malformed adapter output becomes guest; token-like fields are stripped.
- Voice contract: every locale mapped; speech off until tested; fallback text keeps quotes and
  measurements verbatim.

React components were checked by hand in a temporary preview page (not committed); there is no
DOM test runner in the repo.

## 8. Environment variables (names only, none used yet)

| Name | Where | Status |
| --- | --- | --- |
| `VITE_MOJOAUTH_PUBLIC_KEY` | Amplify build env | Only if MojoAuth confirms the browser key is public |
| `MOJOAUTH_API_SECRET` | Supabase Edge Function secret | Server only, for token verification |

## 9. Open questions

1. Confirm "no login for the MVP" (section 1).
2. Confirm Hindi, or name the Indian language(s) the team wants.
3. Who will review each language before the demo?
4. Codex: accept `sourceLanguage` on provider text fields?
5. Ryan B: accept `SpeechSegment` / `SpeechSink`, and which ElevenLabs model will you use?
