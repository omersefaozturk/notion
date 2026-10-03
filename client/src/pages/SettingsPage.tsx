import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { authApi, householdApi } from '../api';
import { PageContainer, PageHeader } from '../components/Layout';
import { OwnerBadge } from '../components/OwnerBadge';
import { Button, ColorPicker, ErrorBox, Field, Input } from '../components/ui';
import { useAuth, useUser } from '../context/AuthContext';
import { COLOR_PALETTE, errorMessage } from '../lib/util';

function Card({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return (
    <section className="rounded-xl border border-neutral-200 p-5">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Notice({ ok, text }: { ok: boolean; text: string }) {
  return <span className={ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{text}</span>;
}

function ProfileCard() {
  const user = useUser();
  const { setUser, refresh } = useAuth();
  const [name, setName] = useState(user.name);
  const [initial, setInitial] = useState(user.initial);
  const [color, setColor] = useState(user.color);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const colors = COLOR_PALETTE.includes(user.color) ? COLOR_PALETTE : [user.color, ...COLOR_PALETTE];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password && password.length < 6) {
      setMsg({ ok: false, text: 'Şifre en az 6 karakter olmalı.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await authApi.updateMe({
        name: name.trim(),
        initial: initial.trim().toLocaleUpperCase('tr-TR') || undefined,
        color,
        ...(password ? { password } : {}),
      });
      setUser(res.user);
      setPassword('');
      void refresh();
      setMsg({ ok: true, text: 'Profil kaydedildi.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Profil" description="Baş harfin ve rengin, ortak görünümlerde yazdıklarını işaretler.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <OwnerBadge owner={{ name, initial: initial || '?', color }} size="lg" />
          <div className="text-sm text-neutral-500">{user.email}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
          <Field label="Ad">
            <Input value={name} required onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Baş harf">
            <Input value={initial} maxLength={1} className="text-center" onChange={(e) => setInitial(e.target.value.toLocaleUpperCase('tr-TR'))} />
          </Field>
        </div>
        <Field label="Renk" plain>
          <ColorPicker value={color} onChange={setColor} colors={colors} />
        </Field>
        <Field label="Yeni şifre" hint="Değiştirmek istemiyorsan boş bırak.">
          <Input type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
          {msg && <Notice {...msg} />}
        </div>
      </form>
    </Card>
  );
}

function HouseholdCard() {
  const user = useUser();
  const { household, setHousehold } = useAuth();
  const [name, setName] = useState(household?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    householdApi
      .get()
      .then((h) => {
        setHousehold(h);
        setName(h.name);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [setHousehold]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const h = await householdApi.update({ name: name.trim() });
      setHousehold(h);
      setMsg({ ok: true, text: 'Kaydedildi.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    try {
      const h = await householdApi.regenerateInvite();
      setHousehold(h);
      setCopied(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function copy() {
    if (!household) return;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
    } catch {
      // Fallback for insecure contexts
      const ta = document.createElement('textarea');
      ta.value = household.inviteCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!household) return error ? <ErrorBox message={error} /> : null;

  return (
    <Card title="Ev" description="Ev üyeleri birbirlerinin ortak öğelerini görebilir.">
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      )}
      <form onSubmit={saveName} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Field label="Ev adı">
            <Input value={name} required onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" disabled={busy || !name.trim() || name.trim() === household.name}>
          Kaydet
        </Button>
        {msg && <Notice {...msg} />}
      </form>

      <div className="mt-6">
        <div className="mb-1 text-xs font-medium text-neutral-600">Davet kodu</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-base tracking-widest text-neutral-900">
            {household.inviteCode}
          </code>
          <Button size="sm" onClick={copy}>
            {copied ? 'Kopyalandı ✓' : 'Kopyala'}
          </Button>
          <Button size="sm" variant="ghost" onClick={regenerate}>
            Yeniden oluştur
          </Button>
        </div>
        <p className="mt-1 text-xs text-neutral-400">Eşin kayıt olurken bu kodu girerek evine katılabilir.</p>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs font-medium text-neutral-600">Üyeler</div>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {household.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <OwnerBadge owner={m} size="md" />
              <span className="text-sm text-neutral-800">{m.name}</span>
              {m.id === user.id && <span className="text-xs text-neutral-400">(sen)</span>}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader icon="⚙️" title="Ayarlar" />
      <div className="space-y-6">
        <ProfileCard />
        <HouseholdCard />
      </div>
    </PageContainer>
  );
}
