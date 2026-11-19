"use client";

import { useReducer, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth-context";

function AuthFrame({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function UnavailableAuth() {
  return (
    <AuthFrame title="Entrar no está disponible" description="Las cuentas no están activas en este sitio.">
      <Button asChild className="w-full"><a href="/">Volver al inicio</a></Button>
    </AuthFrame>
  );
}

function LoadingAuth() {
  return <LoadingState className="min-h-screen rounded-none border-0" title="Cargando tu cuenta…" />;
}

type EmailCodeState = { code: string; pending: "verify" | "resend" | null; message: string | null };
type EmailCodeEvent = { type: "code"; value: string } | { type: "start"; action: "verify" | "resend" } | { type: "error"; message: string } | { type: "sent" };

export function emailCodeReducer(state: EmailCodeState, event: EmailCodeEvent): EmailCodeState {
  switch (event.type) {
    case "code": return { ...state, code: event.value };
    case "start": return { ...state, pending: event.action, message: null };
    case "error": return { ...state, pending: null, message: event.message };
    case "sent": return { code: "", pending: null, message: "Si tu cuenta puede recibir este correo, ya va en camino. Usa el código o el enlace más reciente." };
  }
}

function EmailCodeForm({ email, purpose, onBack, redirectTo = "/" }: { email: string; purpose: "signup" | "login"; onBack(): void; redirectTo?: string }) {
  const auth = useAuth();
  const [state, dispatch] = useReducer(emailCodeReducer, { code: "", pending: null, message: null });
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (state.pending) return;
    dispatch({ type: "start", action: "verify" });
    const result = await auth.verifyEmailCode(email, state.code);
    if (!result.ok) return dispatch({ type: "error", message: result.message ?? "Please try again." });
    window.location.replace(redirectTo);
  };
  const resend = async () => {
    if (state.pending) return;
    dispatch({ type: "start", action: "resend" });
    const result = await (purpose === "signup" ? auth.resendEmailConfirmation(email) : auth.requestEmailSignIn(email, redirectTo));
    dispatch(result.ok ? { type: "sent" } : { type: "error", message: result.message ?? "Please try again." });
  };
  return (
    <AuthFrame title="Revisa tu correo" description={`Escribe el código que enviamos a ${email}, o abre el enlace del correo.`}>
      <form className="space-y-4" onSubmit={(event) => void verify(event)}>
        <div className="space-y-2"><Label htmlFor="email-code">Código del correo</Label><Input id="email-code" autoFocus autoComplete="one-time-code" inputMode="numeric" required value={state.code} disabled={!!state.pending} onChange={(event) => dispatch({ type: "code", value: event.target.value })} /></div>
        {state.message && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
        <Button className="w-full" type="submit" disabled={!!state.pending}>{state.pending === "verify" ? "Verificando…" : "Verificar y continuar"}</Button>
        <Button className="w-full" variant="outline" type="button" disabled={!!state.pending} onClick={() => void resend()}>{state.pending === "resend" ? "Enviando…" : "Reenviar correo"}</Button>
        <Button className="w-full" variant="ghost" type="button" disabled={!!state.pending} onClick={onBack}>Usar otro correo</Button>
      </form>
    </AuthFrame>
  );
}

export function LoginPage({ allowEmailOtp = false, defaultEmailOtp = false, redirectTo = "/" }: { allowEmailOtp?: boolean; defaultEmailOtp?: boolean; redirectTo?: string } = {}) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [emailOnly, setEmailOnly] = useState(defaultEmailOtp);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;
  if (verificationEmail) return <EmailCodeForm email={verificationEmail} purpose="login" redirectTo={redirectTo} onBack={() => setVerificationEmail(null)} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const result = await (emailOnly ? auth.requestEmailSignIn(email.trim(), redirectTo) : auth.signIn(email.trim(), password));
    setPending(false);
    if (!result.ok) return toast.error(result.message);
    if (emailOnly) { setVerificationEmail(email.trim()); return; }
    window.location.replace(redirectTo);
  };

  return (
    <AuthFrame
      title="Bienvenido de nuevo"
      description="Entra para sentarte, chatear y enviar regalos."
      footer={<>¿No tienes cuenta? <a className="text-primary underline-offset-4 hover:underline" href="/register">Regístrate</a></>}
    >
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2">
          <Label htmlFor="login-email">Correo</Label>
          <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        {!emailOnly && <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Contraseña</Label>
            <a className="text-sm text-primary hover:underline" href="/forgot-password">¿Olvidaste la contraseña?</a>
          </div>
          <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>}
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Espera…" : emailOnly ? "Enviar código al correo" : "Entrar"}</Button>
        {allowEmailOtp && <Button className="w-full" type="button" variant="ghost" disabled={pending} onClick={() => { setEmailOnly(!emailOnly); setPassword(""); }}>{emailOnly ? "Usar contraseña" : "Entrar con un código al correo"}</Button>}
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;
  if (verificationEmail) return <EmailCodeForm email={verificationEmail} purpose="signup" onBack={() => setVerificationEmail(null)} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const result = await auth.signUp(email.trim(), password);
    setPending(false);
    if (!result.ok) return toast.error(result.message);
    if (result.needsEmailConfirmation) {
      setPassword("");
      setVerificationEmail(email.trim());
      return;
    }
    window.location.replace("/");
  };

  return (
    <AuthFrame title="Crea tu cuenta" description="Tarda menos de un minuto." footer={<>¿Ya tienes cuenta? <a className="text-primary hover:underline" href="/login">Entrar</a></>}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="register-email">Correo</Label><Input id="register-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="register-password">Contraseña</Label><Input id="register-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Creando tu cuenta…" : "Crear cuenta"}</Button>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await auth.requestPasswordReset(email);
    setPending(false);
    result.ok ? toast.success("Si el correo está registrado, recibirás el enlace.") : toast.error(result.message);
  };

  return (
    <AuthFrame title="Recuperar contraseña" description="Te enviamos un enlace a tu correo." footer={<a className="text-primary hover:underline" href="/login">Volver a entrar</a>}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="reset-email">Correo</Label><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</Button>
      </form>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  if (auth.status === "loading") return <LoadingAuth />;
  if (auth.status === "unavailable") return <UnavailableAuth />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await auth.updatePassword(password);
    setPending(false);
    if (!result.ok) return toast.error(result.message);
    toast.success("Contraseña actualizada.");
    window.location.replace("/login");
  };

  return (
    <AuthFrame title="Nueva contraseña" description="Escribe una contraseña nueva para tu cuenta.">
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="new-password">Contraseña nueva</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</Button>
      </form>
    </AuthFrame>
  );
}
