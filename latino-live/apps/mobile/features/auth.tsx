import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform, Pressable, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { Mail, Sparkles } from 'lucide-react-native';
import { getSupabase, requireSupabase, authRedirect } from '@/lib/supabase';
import { authReducer, initialAuthState, type AuthMode } from '@/lib/auth-state';
import { authErrorText } from '@/lib/auth-messages';
import { config } from '@/lib/config';
import { unregisterPush } from '@/lib/push';
import { cn } from '@/lib/utils';
import { GENDERS, genderPayload, type Gender } from '@/lib/gender';
import { clearProfileCache } from '@/lib/profile-cache';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const AuthContext = createContext<{ session: Session | null; loading: boolean; recovery: boolean; error: string | null }>({ session: null, loading: true, recovery: false, error: null });
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true), [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const client = getSupabase();
    if (!client) { setLoading(false); return; }
    let live = true, revision = 0;
    client.auth.getSession().then(({ data, error }) => {
      if (!live || revision) return;
      setSession(data.session); setLoading(false); if (error) setError(error.message);
    }).catch(() => { if (live) { setLoading(false); setError('No pudimos recuperar tu sesión. Vuelve a entrar.'); } });
    const { data } = client.auth.onAuthStateChange((event, value) => {
      revision++; setSession(value); setLoading(false);
      // Al cerrar sesión, las fichas guardadas de las personas se van con ella.
      if (event === 'SIGNED_OUT') clearProfileCache();
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setRecovery(false);
    });
    const link = async (url: string) => {
      if (Platform.OS === 'web' || !config.scheme) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== `${config.scheme}:` || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return;
        const query = new URLSearchParams(parsed.search || parsed.hash.slice(1));
        const code = query.get('code');
        if (code) { const result = await client.auth.exchangeCodeForSession(code); if (result.error) throw result.error; }
        else {
          const access_token = query.get('access_token'), refresh_token = query.get('refresh_token');
          if (access_token && refresh_token) { const result = await client.auth.setSession({ access_token, refresh_token }); if (result.error) throw result.error; }
        }
        if (query.get('type') === 'recovery') setRecovery(true);
      } catch { if (live) setError('Ese enlace ya no sirve. Pide un correo nuevo.'); }
    };
    void Linking.getInitialURL().then(url => { if (url && live) void link(url); });
    const links = Linking.addEventListener('url', event => { void link(event.url); });
    const activity = AppState.addEventListener('change', state => { if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); });
    return () => { live = false; data.subscription.unsubscribe(); links.remove(); activity.remove(); client.auth.stopAutoRefresh(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, recovery, error }}>{children}</AuthContext.Provider>;
}

// What each mode says: a heading, one line under it and the primary button.
const copy: Record<AuthMode, { title: string; description: string; action: string }> = {
  login: { title: 'Bienvenido de nuevo', description: 'Entra para sentarte, chatear y enviar regalos.', action: 'Entrar' },
  register: { title: 'Crea tu cuenta', description: 'Tarda menos de un minuto.', action: 'Crear cuenta' },
  code: { title: 'Revisa tu correo', description: 'Escribe el código que te enviamos.', action: 'Verificar' },
  'email-login': { title: 'Entrar con un código', description: 'Te enviamos un código por correo y entras sin contraseña.', action: 'Enviar código' },
  reset: { title: 'Recupera tu contraseña', description: 'Escribe el correo con el que te registraste y te enviamos un enlace.', action: 'Enviar enlace' },
  recovery: { title: 'Nueva contraseña', description: 'Elige una contraseña nueva para tu cuenta.', action: 'Actualizar contraseña' },
};

/** A sentence with a link at its end, such as "Don’t have an account? Sign up". */
function LinkRow({ text, action, disabled, onPress }: { text: string; action: string; disabled?: boolean; onPress: () => void }) {
  return (
    <View className="flex-row flex-wrap items-center justify-center">
      <Text className="text-muted-foreground text-sm">{text}</Text>
      <Button variant="link" size="sm" className="h-11 px-1.5" disabled={disabled} onPress={onPress}>
        <Text className="text-foreground text-sm font-medium underline">{action}</Text>
      </Button>
    </View>
  );
}

export function AccountGate({ children, initialMode = 'login' }: { children: ReactNode; initialMode?: AuthMode }) {
  const auth = useAuth();
  const [state, dispatch] = useReducer(authReducer, { ...initialAuthState, mode: initialMode });
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const mode = auth.recovery ? 'recovery' : state.mode;
  async function run(resend = false) {
    if (state.pending) return;
    dispatch({ type: 'pending' });
    try {
      const { auth } = requireSupabase();
      let result: { error: { message: string } | null }, message = '', nextCode: boolean | undefined;
      if (resend) {
        result = state.signupCode ? await auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirect() } })
          : await auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirect(), shouldCreateUser: false } });
        message = 'Correo enviado. Usa el código o enlace más reciente.';
      } else if (mode === 'register') {
        // El sexo viaja con el alta y el servidor lo copia al perfil en el
        // mismo instante: la persona no tiene que volver a elegirlo.
        const chosen = genderPayload(gender);
        if (!chosen) throw new Error('Elige tu sexo para crear la cuenta.');
        const signup = await auth.signUp({ email, password, options: { emailRedirectTo: authRedirect(), data: chosen } }); result = signup;
        if (!signup.data.session) nextCode = true;
        message = 'Revisa tu correo para terminar de crear la cuenta.';
      } else if (mode === 'code') {
        const verified = await auth.verifyOtp({ email, token: code.trim(), type: 'email' }); result = verified;
        if (!verified.error && !verified.data.session) throw new Error('Pide un código nuevo e inténtalo otra vez.');
        message = 'Correo verificado.';
      } else if (mode === 'email-login') {
        result = await auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirect(), shouldCreateUser: false } }); nextCode = false;
        message = 'Si ese correo tiene cuenta, recibirás un mensaje.';
      } else if (mode === 'reset') {
        result = await auth.resetPasswordForEmail(email, { redirectTo: authRedirect() }); message = 'Si ese correo tiene cuenta, recibirás un mensaje para cambiarla.';
      } else if (mode === 'recovery') { result = await auth.updateUser({ password }); message = 'Contraseña actualizada.'; }
      else { result = await auth.signInWithPassword({ email, password }); message = 'Sesión iniciada.'; }
      if (result.error) throw result.error;
      setPassword(''); dispatch({ type: 'done', message, code: nextCode });
    } catch (error) { dispatch({ type: 'error', message: authErrorText(error instanceof Error ? error.message : null) }); }
  }
  if (auth.loading) return <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-center text-sm">Restaurando tu sesión…</Text>;
  if (auth.session && !auth.recovery) return <>{children}</>;
  const { title, description, action } = copy[mode];
  const centered = mode === 'login' || mode === 'code';
  const go = (next: AuthMode) => () => dispatch({ type: 'mode', mode: next });
  const primary = (
    <Button className="w-full" disabled={state.pending} onPress={() => void run()}>
      <Text className="text-base">{state.pending ? 'Un momento…' : action}</Text>
    </Button>
  );
  // What the last request answered. The sign-in provider's own failures are errors; the form's
  // answers (including Supabase's) come back as one message without a severity.
  const feedback = state.message ? (
    <Text role="status" accessibilityLiveRegion="polite" className="text-sm">{state.message}</Text>
  ) : auth.error ? (
    <Text role="alert" accessibilityLiveRegion="polite" className="text-destructive text-sm">{auth.error}</Text>
  ) : null;
  return (
    <View className="flex-1 gap-8">
      <View className="gap-8">
        <View className={cn('gap-1.5', centered && 'items-center')}>
          {mode === 'login' ? (
            <View className="bg-primary mb-[18px] size-12 items-center justify-center rounded-2xl">
              <Icon as={Sparkles} className="text-primary-foreground size-[22px]" />
            </View>
          ) : null}
          {mode === 'code' ? (
            <View className="bg-muted mb-[18px] size-16 items-center justify-center rounded-full">
              <Icon as={Mail} className="size-7" />
            </View>
          ) : null}
          <Text role="heading" className={cn('text-2xl font-semibold tracking-tight', centered && 'text-center')}>{title}</Text>
          <Text className={cn('text-muted-foreground text-sm', centered && 'text-center')}>
            {mode === 'code' && email ? (
              <>Enviamos un código a{'\n'}<Text className="text-foreground text-sm font-medium">{email}</Text></>
            ) : description}
          </Text>
        </View>

        <FieldGroup>
          {mode !== 'recovery' && mode !== 'code' ? (
            <Field>
              <FieldLabel nativeID="email">Correo</FieldLabel>
              <Input aria-labelledby="email" placeholder="tu@correo.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!state.pending} />
            </Field>
          ) : null}
          {['login', 'register', 'recovery'].includes(mode) ? (
            <Field>
              {mode === 'login' ? (
                <View className="flex-row items-center justify-between">
                  <FieldLabel nativeID="password">Contraseña</FieldLabel>
                  <Button variant="link" size="sm" className="h-auto px-0 py-0" hitSlop={10} disabled={state.pending} onPress={go('reset')}>
                    <Text className="text-muted-foreground text-sm font-normal">¿Olvidaste tu contraseña?</Text>
                  </Button>
                </View>
              ) : (
                <FieldLabel nativeID="password">{mode === 'recovery' ? 'Nueva contraseña' : 'Contraseña'}</FieldLabel>
              )}
              <Input
                aria-labelledby="password"
                placeholder={mode === 'login' ? 'Tu contraseña' : mode === 'recovery' ? 'Elige una contraseña nueva' : 'Crea una contraseña'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                editable={!state.pending}
              />
            </Field>
          ) : null}
          {/* El sexo se pide al crear la cuenta, no antes ni después: es parte
              del perfil y la sala lo muestra desde el primer día. */}
          {mode === 'register' ? (
            <Field>
              <FieldLabel nativeID="gender">Sexo</FieldLabel>
              <View
                accessibilityRole="radiogroup"
                aria-labelledby="gender"
                className="flex-row gap-2">
                {GENDERS.map(option => {
                  const active = gender === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      role="radio"
                      aria-checked={active}
                      accessibilityRole="radio"
                      accessibilityLabel={`Sexo: ${option.label}`}
                      accessibilityState={{ selected: active, disabled: state.pending }}
                      disabled={state.pending}
                      onPress={() => setGender(option.key)}
                      className={cn(
                        'h-10 flex-1 flex-row items-center justify-center rounded-md border active:opacity-80',
                        active ? 'border-primary bg-primary' : 'border-border bg-background',
                      )}>
                      <Text className={cn('text-sm font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
          ) : null}
          {mode === 'code' ? (
            <>
              <Input aria-label="Código del correo" placeholder="Código" className="text-center text-lg tracking-widest" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" editable={!state.pending} />
              <LinkRow text="¿No llegó?" action="Reenviar correo" disabled={state.pending} onPress={() => void run(true)} />
            </>
          ) : null}
          {feedback}
          {mode === 'login' ? (
            <>
              <View className="pt-1">{primary}</View>
              <View className="flex-row items-center gap-3">
                <Separator className="w-auto flex-1" />
                <Text className="text-muted-foreground text-sm">o</Text>
                <Separator className="w-auto flex-1" />
              </View>
              <Button variant="outline" className="w-full" disabled={state.pending} onPress={go('email-login')}>
                <Icon as={Mail} className="size-4" />
                <Text className="text-base">Enviarme un código</Text>
              </Button>
            </>
          ) : null}
        </FieldGroup>
      </View>

      <View className="mt-auto gap-2">
        {mode === 'login' ? <LinkRow text="¿No tienes cuenta?" action="Regístrate" disabled={state.pending} onPress={go('register')} /> : primary}
        {mode === 'register' ? <LinkRow text="¿Ya tienes cuenta?" action="Entrar" disabled={state.pending} onPress={go('login')} /> : null}
        {mode === 'code' ? (
          <Button variant="ghost" className="w-full" disabled={state.pending} onPress={go(state.signupCode ? 'register' : 'email-login')}>
            <Text className="text-base">Usar otro correo</Text>
          </Button>
        ) : null}
        {mode === 'email-login' || mode === 'reset' ? (
          <Button variant="ghost" className="w-full" disabled={state.pending} onPress={go('login')}>
            <Text className="text-base">Volver a entrar</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}

export function AccountActions() {
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  async function act(remove: boolean) {
    if (pending) return; setPending(true); setError(null);
    try {
      const client = requireSupabase();
      if (remove) { const result = await client.functions.invoke('delete-account'); if (result.error) throw result.error; }
      // The phone stops receiving notices for this account.
      await unregisterPush();
      const result = await client.auth.signOut(remove ? { scope: 'local' } : undefined); if (result.error) throw result.error;
    } catch { setError('No se pudo completar. Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setPending(false); }
  }
  return (
    <View className="gap-2">
      {error ? <Text role="alert" accessibilityLiveRegion="polite" className="text-destructive text-center text-sm">{error}</Text> : null}
      <Button variant="outline" className="h-11 w-full" disabled={pending} onPress={() => void act(false)}>
        <Text className="text-[15px]">Cerrar sesión</Text>
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="h-11 w-full" disabled={pending}>
            <Text className="text-destructive text-[15px]">Eliminar cuenta</Text>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>Tu cuenta y tus datos de la app se borran para siempre.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text>Conservar cuenta</Text></AlertDialogCancel>
            <AlertDialogAction onPress={() => void act(true)}><Text>Eliminar cuenta</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
