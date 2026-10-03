import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OwnerBadge } from '../components/OwnerBadge';
import { Button, ColorPicker, ErrorBox, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { COLOR_PALETTE, errorMessage } from '../lib/util';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl">📒</div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Ortak Plan" subtitle="Hesabına giriş yap">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="E-posta">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Şifre">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <ErrorBox message={error} />}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        Hesabın yok mu?{' '}
        <Link to="/register" className="font-medium text-neutral-900 underline">
          Kayıt ol
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initial, setInitial] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveInitial = (initial || name.trim().charAt(0) || '?').toLocaleUpperCase('tr-TR');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        initial: effectiveInitial !== '?' ? effectiveInitial : undefined,
        color,
        inviteCode: inviteCode.trim() || undefined,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Kayıt ol" subtitle="Yeni bir hesap oluştur veya eşinin evine katıl">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Ad">
          <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="E-posta">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Şifre" hint="En az 6 karakter">
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <div className="flex items-end gap-3">
          <Field label="Baş harf">
            <Input
              className="w-16 text-center"
              maxLength={1}
              value={initial}
              placeholder={name.trim().charAt(0).toLocaleUpperCase('tr-TR') || 'A'}
              onChange={(e) => setInitial(e.target.value.toLocaleUpperCase('tr-TR'))}
            />
          </Field>
          <div className="pb-1">
            <OwnerBadge owner={{ initial: effectiveInitial, color, name: name || 'Sen' }} size="lg" />
          </div>
        </div>
        <Field label="Renk" plain>
          <ColorPicker value={color} onChange={setColor} colors={COLOR_PALETTE} />
        </Field>
        <Field label="Davet kodu (isteğe bağlı)" hint="Eşinin evine katılmak için onun Ayarlar sayfasındaki kodu gir. Boş bırakırsan yeni bir ev oluşturulur.">
          <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Ör. AB12CD" />
        </Field>
        {error && <ErrorBox message={error} />}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Kaydediliyor…' : 'Kayıt ol'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        Zaten hesabın var mı?{' '}
        <Link to="/login" className="font-medium text-neutral-900 underline">
          Giriş yap
        </Link>
      </p>
    </AuthShell>
  );
}
