# ExaSpark Android app development

Build in this app folder using the pinned Expo SDK 57, Expo Router, TypeScript,
Uniwind (Tailwind 4 for React Native) and React Native Reusables components
restyled to shadcn/ui Maia. Read the existing source,
`docs/README.md` and the shared project `PRODUCT.md` and `DESIGN.md` first.
The project root owns `builder/`, `supabase/`, `design/` and both documents.
One project has at most one Android app. Preserve the user's existing work.

## Deliver the requested app

Replace `app/index.tsx` with the real primary screen; use the catalogue, nine
component examples, 21 page examples and the tab-bar app shell in `app/tabs/`
as composition references. Build the app directly; never ask whether to make
a design draft first. Read the design skill, shared visual tokens and relevant
component guidance, then make the real primary screen and navigation usable
in Preview **before backend setup**. The unchanged catalogue is not a product
screen. Do not enable or wait for the backend, discover database tools, write
migrations, or configure accounts and payments before that visible milestone,
including in parallel with UI work. Existing usable screens satisfy it.
Show the rendered screen as soon as it works, report what is usable, then finish
all the requested backend and integration work in the same turn. Sample data must say it is sample data;
never simulate successful authentication, payments or saves. Keep local-only
state in AsyncStorage until accounts or shared data are needed.

## Components and design

Read `docs/design-rules.md` and the relevant `docs/components/` file. Compose
installed primitives (`Screen`, `Item`, `Field`, `InputGroup`, `Empty`, `Card`,
`Button` and the rest of `components/ui`) before adding a dependency or
inventing a component. Keep Maia's Geist typography, Lucide icons, semantic
colors and rounded controls. Website and app read the same DESIGN.md through
the shared compiler, which writes complete colors into `spk-design.css` for
`global.css`. Change tokens through the platform's design publication workflow,
never edit `spk-design.css` or the generated compiler. Native font assets need
`useFonts`; CSS font declarations alone do not install a native font.

## Backend, accounts and payments

- All apps share one project backend and the same accounts, tables and rules.
  Read existing migrations/functions/sign-in first. Call
  `enable_managed_backend` only if needed, after the usable frontend milestone.
  No keys are requested from the user.
- `lib/supabase.ts` uses the resolved public URL and anon key. Preview uses dev;
  installed builds use the selected published backend. Never embed service
  credentials, private keys or payment secrets in EXPO_PUBLIC variables.
- Use `AccountGate` from `features/auth.tsx` for protected screens: password
  sign-in, sign-up/email verification, email OTP, password reset and recovery.
  Keep `AuthProvider`, `/auth/callback` and the platform-owned application scheme.
- Include `AccountActions` so people can sign out and delete their account.
  Deploy `supabase/functions/delete-account` through `spk_supabase_call` when
  enabling accounts. User-owned rows use RLS and `auth.users ON DELETE CASCADE`;
  uploads live under the user ID. Migrations remain compatible with installed
  older versions; never silently rename/drop a field they use.
- `lib/payments.ts` uses the project's existing Stripe products, customers and
  orders. Use `products`, `priceLabel`, `visitPayment('checkout', price.id)` and
  `useOwnership`. Subscriptions/unlocks need AccountGate. Call visitPayment
  directly from the press handler, so the browser can open its checkout tab.
  `visitPayment('portal')` manages subscriptions. Show pending/errors and retry;
  only server entitlements prove ownership. Enforce paid-data access with RLS
  over `spk_payment_entitlements`, including user ID, entitlement key and active.
- Google Play digital purchases require Play billing; explain this before a
  user submits such an app there. Existing Stripe flows serve direct installs
  and eligible physical goods/services.

## Preview, navigation and validation

Keep `PreviewProvider`, `AppUpdateGate`, the Query/Auth providers and PortalHost
in `_layout.tsx`. Use SafeAreaView and native keyboard/back behavior. Keep input
when a request fails; offer an actionable retry. Use accessible labels and focus
states, and 48 dp primary buttons / 44 dp inputs.

Preview already runs Metro with Fast Refresh. Never start another server or run
Expo prebuild/Gradle in the interactive workspace. Check `spk_preview_status`
and logs, then inspect the actual rendered DOM and interaction with browser
tools; HTTP 200 alone is not visual acceptance. Screenshot, back, safe-area and
element selection use the existing Preview bridge. Web-only APIs need a
Platform.OS guard; only install libraries that work in web and Android.

Run `npm run typecheck` (types, plus text outside `<Text>` that would crash
Android) and `npm test`; fix errors. Commit the task's files and call
`check_production_build` once: it type-checks and bundles the app in a separate
build environment in about a minute. Do not repeat a check that passed on
unchanged code. Installing packages happens through Install on phone; website
publication does not publish Android. The platform owns package ID, name, icon,
version, signing and install link. Never add signing keys/configuration. After
publishing an incompatible version, use `spk_app_minimum_version` as authorized.
Keep app copy about the user's task, not the runtime or platform architecture.
