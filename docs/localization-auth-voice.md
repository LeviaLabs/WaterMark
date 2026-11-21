# Localization, optional sign-in and voice language: how it works

- Task: WM-CLAUDE-001 (revision R2, after Ryan Bergman's review)
- Human owner: Decong · Branch: `feat/decong-auth-i18n` · PR: LeviaLabs/WaterMark#1
- Reviewers: Ryan Bergman (frontend shell, voice), Ryan Lin (app page), Codex (Supabase)

**Status: not integrated into the running app.** Nothing in `App.tsx` or `main.tsx` imports
this code yet. **MojoAuth email-code sign-in** is added on the stacked branch
`feat/decong-mojoauth-login`; see [`mojoauth-login.md`](./mojoauth-login.md). **ElevenLabs is not
called** (no SDK, no HTTP request). The app stays guest-only until the providers are mounted.

## 1. Directory structure

Files follow the frontend layout in the PROMPTING tab and PR #5: UI in `components/`,
providers in `context/`, hooks in `hooks/`, helpers in `scripting/`, integration interfaces in
`services/`, tests in `WaterMark/tests/`.

```text
WaterMark/
├── src/
│   ├── components/
│   │   ├── LanguageSelect.tsx     language picker (Astryx Selector)
│   │   ├── OfficialText.tsx       official warning text, shown as issued, optional unofficial translation
│   │   ├── AuthStatus.tsx         "Browsing as a guest" / signed-in status for a header
│   │   └── RequireAccount.tsx     hides account-only features from guests (display gate only)
│   ├── context/
│   │   ├── LocalizationProvider.tsx  holds the current language, sets <html lang>, saves the choice
│   │   └── AuthProvider.tsx          holds sign-in state; guest-only unless an adapter is passed
│   ├── hooks/
│   │   ├── useLocalization.ts     the localization context and its hook
│   │   └── useAuth.ts             the auth context and its hook
│   ├── scripting/localization/
│   │   ├── localize.ts            languages, locale detection, translate(), Intl formatting
│   │   └── messages/              en (source), es, zh-Hans, ru, hi dictionaries + index
│   └── services/
│       ├── auth/session.ts        session types, guest adapter, access rules, input validation
│       └── voice/voiceLanguages.ts  locale → ElevenLabs language map, speech segment types
└── tests/
    ├── localization.test.ts       dictionaries, locale matching, formatting, voice map
    └── auth.test.ts               access rules, expiry, adapter validation, guest adapter
```

Each context object lives next to its hook (`hooks/`). The provider component lives in
`context/`. That keeps one component per `.tsx` file, which the React Fast Refresh lint
rule requires, without extra files.

## 2. How it works

**Localization.** `LocalizationProvider` picks the language once: `?lang=` in the URL, then
the saved choice (`localStorage` key `wm-locale`), then the browser's languages, then English.
It sets `<html lang>` and saves changes. `useLocalization()` returns:
- `locale` and `setLocale`.
- `t(key, vars)` for interface text. It falls back to English, then to the key.
- `formatNumber`, `formatMeasurement`, `formatDateTime` and `languageName`, all using the
  browser's built-in `Intl` APIs.

Design decisions:
- **No i18n library.** About 40 strings and five languages do not need one. The built-in `Intl`
  APIs handle numbers, dates and language names.
- **Dictionaries are typed against English**, so a missing key fails the type check and a test.
- **Units are never converted** (`2.13 in/hr` stays `in/hr`), and **missing values show
  "Unknown", never 0**.
- **Dates always show the time zone.**
- **Traditional Chinese (`zh-TW`, `zh-Hant`, `zh-HK`) is not matched to Simplified.** Those
  readers fall back to English instead of getting the wrong script.
- **Official warnings are never passed through `t()`.** `OfficialText` shows them word for word,
  in their own language, with source, issue time and link. A translation, if any, comes after
  and is labelled "Unofficial translation".

**Sign-in.** `AuthProvider` defaults to `guestAdapter`: everyone is a guest, nothing is
stored, nothing is fetched.
- `canUse(feature)` always allows map, alerts, forecasts, sources, search and voice. Only
  `savedPlaces` and `notificationPrefs` (neither is built) need an account.
- `sanitizeState` rebuilds any adapter result field by field, so tokens or unexpected fields
  never reach React state.
- An expiring session uses one `setTimeout` at its expiry time. There is no `setInterval`, and
  access checks compare against the clock on every call anyway.

**Voice language.** `voiceLanguages.ts` maps each interface language to the code ElevenLabs
expects (`zh-Hans` → `zh`). Every entry is `listed-untested`, so `canSpeak` is false. It also
defines `SpeechSegment` and the `SpeechSink` interface Ryan B's voice module would implement.

## 3. MojoAuth: what is and is not implemented

| Question | Answer |
| --- | --- |
| Is MojoAuth integrated? | **No.** No MojoAuth SDK, script or account settings are in the code. |
| Does this PR make authentication HTTP requests? | **No.** The only adapter is `guestAdapter`, and it makes no request. |
| What exists? | A provider-neutral seam: `AuthAdapter` interface, `AuthProvider`, `useAuth`, `AuthStatus`, `RequireAccount`, plus the session rules and validation in `services/auth/session.ts`. |
| What gives guest access? | `guestAdapter` (the default), `canUse()` and `RequireAccount`. |
| What is needed for real sign-in? | (1) Confirm in MojoAuth's dashboard that the browser key is public, and restrict allowed origins. (2) Get the JWKS URL, issuer and audience. (3) Codex builds a Supabase Edge Function (proposed `auth-verify`) that verifies the RS256 token server-side and returns `{ id, displayName, expiresAt }`. (4) Write a `mojoAuthAdapter` implementing `AuthAdapter` that sends the token once to that function. (5) Pass it as `<AuthProvider adapter={mojoAuthAdapter}>`. (6) Add RLS on any profile or saved-place tables. |

Why not now: nothing in P0 needs an account, and guest access must always work (AGENTS.md).
MojoAuth was chosen over SSOJet because it offers passwordless sign-in for residents, while
SSOJet is enterprise SSO.

## 4. ElevenLabs: what is and is not implemented

| Question | Answer |
| --- | --- |
| Does this PR call the ElevenLabs API? | **No.** No HTTP request of any kind. |
| Does it use an ElevenLabs SDK? | **No.** No new dependency. |
| What is it? | A language contract: which ElevenLabs language code each interface language uses, whether it has been tested, and the shape of what to speak (`SpeechSegment`, `SpeechSink`). |
| Source of the language list | ElevenLabs help centre page "What languages do you support?", read 2026-11-21. Lists en, es, zh, ru and hi for Multilingual v2, Flash v2.5 and Eleven v3. Not tested by us. |

Ryan Bergman owns the ElevenLabs integration. His steps:
1. Implement `SpeechSink` (`speak(voice, segments)`, `cancel()`) in his voice module.
2. Read the language from `useLocalization().locale`, then `resolveVoiceLanguage(locale)`.
3. When `canSpeak` is false, show `t('voice.unavailable', { language })` and the text from
   `speechFallbackText(segments)`. Never fall back to English speech silently.
4. After hearing a language work end to end, change its entry to `support: 'tested'`.

## 5. Tooling, dependencies and network

- **New dependencies: none.** No i18n library, auth SDK or ElevenLabs SDK.
- **Libraries used:**
  - React context and hooks.
  - Astryx components already installed on `main`: `Selector`, `SelectorOption`, `HStack`,
    `VStack`, `Text`, `Button`, `Blockquote`, `Link`, `Divider`, `Heading`.
  - Browser `Intl` APIs.
  - Node's built-in test runner (`node --test`).
- **Shared file changed:** one `test` script line in `WaterMark/package.json`.
- **External HTTP calls:** none in the localization code. The MojoAuth sign-in calls are listed
  in [`mojoauth-login.md`](./mojoauth-login.md).
- **Browser storage:** `localStorage` key `wm-locale` (language code only); `sessionStorage` key
  `wm-auth` (verified MojoAuth token, only after sign-in).
- **Credentials (names only):** `VITE_MOJOAUTH_API_KEY` (public MojoAuth API key),
  `VITE_WATERMARK_AUTH_VERIFY_URL`, and Edge Function secrets `MOJOAUTH_API_KEY`,
  `WATERMARK_ALLOWED_ORIGINS`, optional `MOJOAUTH_ISSUER`. No MojoAuth API secret is used.

## 6. Integration steps

**Ryan Bergman (`main.tsx`, landing, voice)**
1. Wrap `<App />` once, inside the existing `<Theme>` (and PR #5's `ThemeProvider`, if merged):
   ```tsx
   import { LocalizationProvider } from './context/LocalizationProvider.tsx'
   import { AuthProvider } from './context/AuthProvider.tsx'

   <LocalizationProvider>
     <AuthProvider>
       <App />
     </AuthProvider>
   </LocalizationProvider>
   ```
2. Put `<LanguageSelect />` in the site nav. Leave out `<AuthStatus />` while sign-in is off.
3. Voice: follow section 4.

**Ryan Lin (app/map page)**
1. Use `useLocalization()`: `t` for interface text, `formatMeasurement(value, unit)`, and
   `<time dateTime={iso}>{formatDateTime(iso, 'America/New_York')}</time>`.
2. Render official alerts with `<OfficialText text sourceName sourceLanguage sourceUrl issuedAt />`.
   Never pass alert text through `t()`.
3. Optional: `<LanguageSelect hideLabel />` in the map toolbar. Never wrap the map in `<RequireAccount>`.
4. Add new strings to `messages/en.ts` first. The type check then lists what each language is missing.

**Codex (Supabase)**
1. Confirm provider text fields carry `sourceLanguage` (BCP 47), and the backend never
   machine-translates official text.
2. Later, only if accounts are approved: build the `auth-verify` Edge Function described in section 3.

Merge order: this PR first (it adds files only), then the `main.tsx` mount, then page usage.
To roll back, revert the mount commit.

## 7. Accessibility

- The picker is an Astryx `Selector`. It has a real `<label for>` (`hideLabel` keeps it for
  screen readers), typeahead, a visible focus ring, Escape returns focus, and it opens as a
  bottom sheet on phones.
- Language names, official text and translations are wrapped in `<bdi lang>`, because Astryx
  components do not accept `lang`. Official text keeps its line breaks with `<br>`.
- Sign-in status is `role="status"` with `aria-live="polite"`. Error and expired messages say
  the map still works.
- The picker is 36 px tall at `size="lg"`: WCAG 2.2 AA (24 px), not 44 px. A larger size is a
  theme setting, not a per-component override.

## 8. Tests

```text
cd WaterMark && npm test     # node --test "tests/**/*.test.ts", 40 tests
```

The tests cover:
- Every language has every key and the same `{placeholders}`.
- Locale matching, including the Traditional Chinese case.
- English fallback; units kept verbatim; "Unknown" instead of 0; time zone shown.
- Public features work in every auth state; account features need a live session; expired
  sessions do not unlock; malformed adapter output becomes guest; tokens are stripped.
- Speech stays off until a language is tested.

React components were checked by hand in a temporary preview inside the app's Astryx `Theme`,
at 1280 px and 375 px. There is no DOM test runner in the repo.

## 9. Conflicts with other instructions

- **Styling.** The PROMPTING tab and PR #5 put custom visuals in `src/styling/*.css`. These
  components are standard controls, which PR #5 says should use Astryx components and tokens.
  So they have no CSS file and no `styling/` entry. Both rules agree here.
- **Test runner.** PR #5 uses Vitest (`vitest run`, `tests/**/*.test.ts`). `main` has no Vitest
  yet, and adding it here would touch `vite.config.ts` and the lockfile that PR #5 also changes.
  These tests already live in `WaterMark/tests/`. After PR #5 merges, switch the two
  `node:test` imports to `vitest` and keep its `test` script. `node:assert` works under Vitest.

## 10. Translation rules

- Interface text only. Official warnings stay as issued.
- Numbers, units, times, place names and agency names stay as the source gives them.
- "No data" and "no active alerts" always say this does not mean safe.
- Non-English strings were drafted with AI assistance and need native-speaker review.
  **Hindi is a candidate** until the team confirms which Indian language(s) to use.

## 11. Open questions

1. Ryan B: are the folder choices right (localization helpers in `scripting/`, auth and voice
   interfaces in `services/`)?
2. Ryan B: accept `SpeechSegment` / `SpeechSink`, and which ElevenLabs model will you use?
3. Ryan B: is the 36 px picker height acceptable, or should the theme raise control size?
4. Team: confirm Hindi, and who reviews each language before the demo.
5. Codex: accept `sourceLanguage` on provider text fields?

## 12. Explaining it to judges (about 30 seconds)

"WaterMark's interface works in English, Spanish, Chinese, Russian and Hindi. We wrote a small
localization layer on the browser's built-in Intl APIs instead of adding a library. Official
flood warnings are never machine-translated in place: they are shown exactly as the National
Weather Service issued them, and any translation is labelled unofficial. Measurements keep
their original units, and missing data says 'Unknown', never zero. Accounts are optional by
design: the map and warnings work for everyone without signing in, and we left a typed seam
for passwordless MojoAuth later. Voice languages are mapped for ElevenLabs but stay off until
we have tested each one."
