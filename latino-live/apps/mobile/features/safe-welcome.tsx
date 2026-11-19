import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/features/auth';
import { authRedirect, requireSupabase } from '@/lib/supabase';
import { authErrorText } from '@/lib/auth-messages';
import { config } from '@/lib/config';
import { useDesignTheme } from '@/features/design-theme';
import { FireBackdrop } from '@/components/fire-backdrop';
import { GENDERS, genderPayload } from '@/lib/gender';
import type { Gender } from '@/lib/gender';

/**
 * The first screen of Latino Live. It is built with React Native alone (no style
 * classes), so it appears on every phone even when the app's styling layer
 * cannot start there. From here people create an account or sign in.
 */

type Mode = 'login' | 'register' | 'code';

type Palette = { bg: string; card: string; border: string; text: string; muted: string; gold: string; onGold: string; field: string };

const THEMES: Record<'light' | 'dark', Palette> = {
  dark: {
    bg: '#080607', card: '#171113', border: '#3D2B2D', text: '#FFFFFF',
    muted: '#D8C9BE', gold: '#FFC24B', onGold: '#2A1B06', field: '#120D10',
  },
  light: {
    bg: '#F1EFEA', card: '#FFFFFF', border: '#DCD7CC', text: '#121110',
    muted: '#5A5348', gold: '#8A5B08', onGold: '#FFF9EC', field: '#FFFFFF',
  },
};

export function SafeWelcome() {
  const auth = useAuth();
  const { colorScheme } = useDesignTheme();
  const t = THEMES[colorScheme === 'light' ? 'light' : 'dark'];
  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'main' | 'resend') {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { auth: client } = requireSupabase();
      const cleanEmail = email.trim();
      if (!cleanEmail) throw new Error('Escribe tu correo.');

      if (action === 'resend') {
        const result = await client.resend({ type: 'signup', email: cleanEmail, options: { emailRedirectTo: authRedirect() } });
        if (result.error) throw result.error;
        setNotice('Te enviamos otro correo. Usa el código más reciente.');
        return;
      }
      if (mode === 'register') {
        if (password.length < 6) throw new Error('La contraseña necesita al menos 6 caracteres.');
        const chosen = genderPayload(gender);
        if (!chosen) throw new Error('Elige tu sexo para crear la cuenta.');
        const result = await client.signUp({
          email: cleanEmail,
          password,
          // El sexo viaja con el alta y el servidor lo copia al perfil en el
          // mismo instante: la persona no tiene que volver a elegirlo.
          options: { emailRedirectTo: authRedirect(), data: chosen },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          setNotice('Cuenta creada. Entrando…');
        } else {
          setMode('code');
          setNotice('Revisa tu correo: enviamos un código para activar la cuenta.');
        }
        setPassword('');
        return;
      }
      if (mode === 'code') {
        const token = code.trim();
        if (!token) throw new Error('Escribe el código que llegó a tu correo.');
        const result = await client.verifyOtp({ email: cleanEmail, token, type: 'email' });
        if (result.error) throw result.error;
        if (!result.data.session) throw new Error('Pide un código nuevo e inténtalo otra vez.');
        setNotice('Correo verificado. Entrando…');
        return;
      }
      const result = await client.signInWithPassword({ email: cleanEmail, password });
      if (result.error) throw result.error;
      setNotice('Sesión iniciada.');
      setPassword('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo completar.';
      setError(authErrorText(message));
    } finally {
      setBusy(false);
    }
  }

  if (auth.loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: t.bg }}>
        <ActivityIndicator color={t.gold} />
        <Text style={{ color: t.muted, fontSize: 13 }}>Abriendo Latino Live…</Text>
      </View>
    );
  }

  // A package built without the project's connection cannot sign anyone in;
  // saying so is better than a form that answers with an error every time.
  if (!config.backend) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: t.bg, paddingHorizontal: 26 }}>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: '700', letterSpacing: 3 }}>LATINO LIVE</Text>
        <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 4 }}>SALAS DE VOZ</Text>
        <Text style={{ marginTop: 14, color: t.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
          Esta instalación no tiene la conexión de Latino Live
        </Text>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
          Instala la versión más reciente desde el enlace de instalación. Si sigue igual, envíale este texto al creador de la app.
        </Text>
        <Text style={{ color: '#8A8073', fontSize: 11 }}>Versión {config.versionCode || 1}</Text>
      </View>
    );
  }

  const title = mode === 'login' ? 'Bienvenido de nuevo' : mode === 'code' ? 'Revisa tu correo' : 'Crea tu cuenta';
  const subtitle = mode === 'login'
    ? 'Entra para sentarte, chatear y enviar regalos.'
    : mode === 'code'
      ? `Escribe el código que enviamos a ${email.trim() || 'tu correo'}.`
      : 'Tarda menos de un minuto.';
  const action = mode === 'login' ? 'Entrar' : mode === 'code' ? 'Verificar' : 'Crear cuenta';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Fire and lightning sit behind the form and never take the finger. */}
      <FireBackdrop night={colorScheme !== 'light'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          // En una tablet o una ventana ancha el formulario se queda como una
          // columna de teléfono, centrada: el campo de correo no se estira de
          // lado a lado de la pantalla.
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 36,
            paddingBottom: 40,
            width: '100%',
            maxWidth: 460,
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', gap: 8, paddingBottom: 22 }}>
            {/* The emblem, drawn from its transparent PNG so no box shows behind it. */}
            <Image
              source={require('@/assets/brand-logo-512.webp')}
              resizeMode="contain"
              style={{ width: 132, height: 132 }}
              accessibilityIgnoresInvertColors
            />
            <Text style={{ color: t.text, fontSize: 20, fontWeight: '700', letterSpacing: 3, marginTop: 4 }}>LATINO LIVE</Text>
            <Text style={{ color: t.muted, fontSize: 11, letterSpacing: 4, marginBottom: 10 }}>SALAS DE VOZ</Text>
          </View>

          <Text style={{ color: t.text, fontSize: 21, fontWeight: '700', marginTop: 4 }}>{title}</Text>
          <Text style={{ color: t.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{subtitle}</Text>

          {mode !== 'code' ? (
            <View style={{ marginTop: 16, gap: 6 }}>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>Correo</Text>
              <TextInput
                accessibilityLabel="Correo"
                placeholder="tu@correo.com"
                placeholderTextColor="#6B6156"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!busy}
                style={inputStyle(t)}
              />
            </View>
          ) : null}

          {mode !== 'code' ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>Contraseña</Text>
              <TextInput
                accessibilityLabel="Contraseña"
                placeholder={mode === 'login' ? 'Tu contraseña' : 'Crea una contraseña'}
                placeholderTextColor="#6B6156"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!busy}
                style={inputStyle(t)}
              />
              {/* Solo al crear la cuenta: es parte del perfil, y aquí se elige
                  una vez para que la sala ya muestre quién es la persona. */}
              {mode === 'register' ? (
                <>
                  <Text style={{ marginTop: 10, color: t.muted, fontSize: 12, fontWeight: '600' }}>Sexo</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
                    {GENDERS.map(option => {
                      const active = gender === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          accessibilityRole="radio"
                          accessibilityLabel={`Sexo: ${option.label}`}
                          accessibilityState={{ selected: active, disabled: busy }}
                          disabled={busy}
                          onPress={() => { setGender(option.key); setError(null); }}
                          style={{
                            height: 42, flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                            borderWidth: active ? 1.5 : 1,
                            borderColor: active ? t.gold : t.border,
                            backgroundColor: active ? 'rgba(255,194,75,0.16)' : t.field,
                          }}>
                          <Text style={{ color: active ? t.gold : t.text, fontSize: 13, fontWeight: '700' }}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 6 }}>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>Código del correo</Text>
              <TextInput
                accessibilityLabel="Código del correo"
                placeholder="123456"
                placeholderTextColor="#6B6156"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                editable={!busy}
                style={[inputStyle(t), { textAlign: 'center', letterSpacing: 6, fontSize: 18 }]}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Reenviar correo" disabled={busy} onPress={() => void run('resend')}>
                <Text style={{ color: t.gold, fontSize: 13, paddingVertical: 6 }}>Reenviar correo</Text>
              </Pressable>
            </View>
          )}

          {error ? <Text style={[feedbackStyle, { color: '#F2A6A0' }]}>{error}</Text> : null}
          {notice ? <Text style={[feedbackStyle, { color: t.gold }]}>{notice}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void run('main')}
            style={{
              marginTop: 16, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
              backgroundColor: t.gold, opacity: busy ? 0.7 : 1,
            }}>
            {busy ? <ActivityIndicator color={t.onGold} /> : <Text style={{ color: t.onGold, fontSize: 15, fontWeight: '700' }}>{action}</Text>}
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: 16 }}>
            {mode === 'login' ? (
              <SwitchLine t={t} text="¿No tienes cuenta?" action="Regístrate" onPress={() => { setMode('register'); setError(null); setNotice(null); }} />
            ) : mode === 'code' ? (
              <SwitchLine t={t} text="¿Usaste otro correo?" action="Empezar de nuevo" onPress={() => { setMode('register'); setError(null); setNotice(null); }} />
            ) : (
              <SwitchLine t={t} text="¿Ya tienes cuenta?" action="Entrar" onPress={() => { setMode('login'); setError(null); setNotice(null); }} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const inputStyle = (t: Palette) => ({
  height: 48,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: t.border,
  backgroundColor: t.field,
  color: t.text,
  paddingHorizontal: 14,
  fontSize: 15,
});

const feedbackStyle = {
  marginTop: 12,
  fontSize: 13,
  lineHeight: 19,
  textAlign: 'center',
} as const;

function SwitchLine({ text, action, onPress, t }: { text: string; action: string; onPress: () => void; t: Palette }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ color: t.muted, fontSize: 13 }}>{text} </Text>
      <Text style={{ color: t.text, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>{action}</Text>
    </Pressable>
  );
}
