'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Copy, ExternalLink, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import type { UserApiKeyListItem } from '@/server/user-api/api-keys';

type UserApiKeysCardProps = {
  initialKeys: UserApiKeyListItem[];
};

type UserApiKeysCopy = {
  title: string;
  description: string;
  docs: string;
  keyNamePlaceholder: string;
  apiKeyNameAria: string;
  read: string;
  write: string;
  generate: string;
  copyCreatedKeyTitle: string;
  copy: string;
  emptyState: string;
  revoked: string;
  prefix: string;
  created: string;
  lastUsed: string;
  revoke: string;
  activeCount: (count: number) => string;
  apiKeyNameRequired: string;
  accessLevelRequired: string;
  requestFailed: string;
  apiKeyGenerated: string;
  apiKeyGenerateFailed: string;
  apiKeyRevoked: string;
  apiKeyRevokeFailed: string;
  apiKeyCopied: string;
};

function formatRussianActiveCount(count: number) {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count.toLocaleString('ru-RU')} активный`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count.toLocaleString('ru-RU')} активных`;
  return `${count.toLocaleString('ru-RU')} активных`;
}

const COPY: Record<AppLanguageCode, UserApiKeysCopy> = {
  en: {
    title: 'User API keys',
    description: 'Create bearer keys for your account API. Plaintext keys are shown once.',
    docs: 'Docs',
    keyNamePlaceholder: 'Key name',
    apiKeyNameAria: 'API key name',
    read: 'Read',
    write: 'Write',
    generate: 'Generate',
    copyCreatedKeyTitle: 'Copy this key now',
    copy: 'Copy',
    emptyState: 'No API keys created yet.',
    revoked: 'Revoked',
    prefix: 'Prefix',
    created: 'Created',
    lastUsed: 'Last used',
    revoke: 'Revoke',
    activeCount: (count) => `${count.toLocaleString('en-US')} active`,
    apiKeyNameRequired: 'API key name is required',
    accessLevelRequired: 'Select at least one access level',
    requestFailed: 'Request failed',
    apiKeyGenerated: 'API key generated',
    apiKeyGenerateFailed: 'Failed to generate API key',
    apiKeyRevoked: 'API key revoked',
    apiKeyRevokeFailed: 'Failed to revoke API key',
    apiKeyCopied: 'API key copied',
  },
  ru: {
    title: 'API-ключи пользователя',
    description: 'Создавайте bearer-ключи для API аккаунта. Открытый ключ показывается только один раз.',
    docs: 'Документация',
    keyNamePlaceholder: 'Название ключа',
    apiKeyNameAria: 'Название API-ключа',
    read: 'Чтение',
    write: 'Запись',
    generate: 'Создать',
    copyCreatedKeyTitle: 'Скопируйте этот ключ сейчас',
    copy: 'Скопировать',
    emptyState: 'API-ключи еще не созданы.',
    revoked: 'Отозван',
    prefix: 'Префикс',
    created: 'Создан',
    lastUsed: 'Последнее использование',
    revoke: 'Отозвать',
    activeCount: formatRussianActiveCount,
    apiKeyNameRequired: 'Введите название API-ключа',
    accessLevelRequired: 'Выберите хотя бы один уровень доступа',
    requestFailed: 'Запрос не выполнен',
    apiKeyGenerated: 'API-ключ создан',
    apiKeyGenerateFailed: 'Не удалось создать API-ключ',
    apiKeyRevoked: 'API-ключ отозван',
    apiKeyRevokeFailed: 'Не удалось отозвать API-ключ',
    apiKeyCopied: 'API-ключ скопирован',
  },
};

const DATE_TIME_FORMATTERS: Record<AppLanguageCode, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }),
  ru: new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }),
};

async function readJsonResponse(response: Response, fallbackMessage: string) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message || fallbackMessage;
    throw new Error(message);
  }
  return body;
}

function formatMaybeDate(value: string | null, language: AppLanguageCode) {
  if (!value) return null;
  try {
    return DATE_TIME_FORMATTERS[language].format(new Date(value));
  } catch {
    return value;
  }
}

export function UserApiKeysCard({ initialKeys }: UserApiKeysCardProps) {
  const { language } = useAppLanguage();
  const copy = COPY[language];
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState('');
  const [readEnabled, setReadEnabled] = useState(true);
  const [writeEnabled, setWriteEnabled] = useState(true);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const activeKeys = keys.filter((key) => !key.revokedAt);

  const createKey = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(copy.apiKeyNameRequired);
      return;
    }
    const scopes = [
      ...(readEnabled ? ['read'] : []),
      ...(writeEnabled ? ['write'] : []),
    ];
    if (scopes.length === 0) {
      toast.error(copy.accessLevelRequired);
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/account/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, scopes }),
      });
      const body = await readJsonResponse(response, copy.requestFailed) as { key: string; item: UserApiKeyListItem };
      setKeys((current) => [body.item, ...current]);
      setCreatedKey(body.key);
      setName('');
      setReadEnabled(true);
      setWriteEnabled(true);
      toast.success(copy.apiKeyGenerated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.apiKeyGenerateFailed);
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    setRevokingId(id);
    try {
      const response = await fetch(`/api/account/api-keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const body = await readJsonResponse(response, copy.requestFailed) as { item: UserApiKeyListItem };
      setKeys((current) => current.map((key) => (key.id === id ? body.item : key)));
      toast.success(copy.apiKeyRevoked);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.apiKeyRevokeFailed);
    } finally {
      setRevokingId(null);
    }
  };

  const copyCreatedKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    toast.success(copy.apiKeyCopied);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="inline-flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-500" />
            {copy.title}
          </CardTitle>
          <CardDescription>
            {copy.description}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{copy.activeCount(activeKeys.length)}</Badge>
          <Button asChild type="button" variant="outline" size="sm" className="cursor-pointer">
            <Link href="/api/user/v1/docs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {copy.docs}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={copy.keyNamePlaceholder}
            maxLength={120}
            disabled={creating}
            aria-label={copy.apiKeyNameAria}
          />
          <div className="flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
              <Checkbox
                checked={readEnabled}
                onCheckedChange={(checked) => setReadEnabled(checked === true)}
                disabled={creating}
              />
              {copy.read}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
              <Checkbox
                checked={writeEnabled}
                onCheckedChange={(checked) => setWriteEnabled(checked === true)}
                disabled={creating}
              />
              {copy.write}
            </label>
            <Button type="button" className="cursor-pointer" onClick={() => void createKey()} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              {copy.generate}
            </Button>
          </div>
        </div>

        {createdKey ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
              {copy.copyCreatedKeyTitle}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-auto rounded border border-amber-200 bg-white px-3 py-2 text-xs dark:border-amber-900 dark:bg-gray-950">
                {createdKey}
              </code>
              <Button type="button" className="cursor-pointer" variant="outline" onClick={() => void copyCreatedKey()}>
                <Copy className="mr-2 h-4 w-4" />
                {copy.copy}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {keys.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-300">{copy.emptyState}</p>
          ) : (
            keys.map((apiKey) => {
              const createdAt = formatMaybeDate(apiKey.createdAt, language);
              const lastUsedAt = formatMaybeDate(apiKey.lastUsedAt, language);
              const revokedAt = formatMaybeDate(apiKey.revokedAt, language);
              return (
                <div
                  key={apiKey.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{apiKey.name}</span>
                      {apiKey.revokedAt ? <Badge variant="danger">{copy.revoked}</Badge> : null}
                      {apiKey.scopes.includes('read') ? <Badge>{copy.read}</Badge> : null}
                      {apiKey.scopes.includes('write') ? <Badge>{copy.write}</Badge> : null}
                    </div>
                    <div className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                      {copy.prefix}: {apiKey.tokenPrefix}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {copy.created} {createdAt ?? apiKey.createdAt}
                      {lastUsedAt ? ` | ${copy.lastUsed} ${lastUsedAt}` : ''}
                      {revokedAt ? ` | ${copy.revoked} ${revokedAt}` : ''}
                    </div>
                  </div>
                  {!apiKey.revokedAt ? (
                    <Button
                      type="button"
                      className="cursor-pointer"
                      variant="outline"
                      size="sm"
                      onClick={() => void revokeKey(apiKey.id)}
                      disabled={revokingId === apiKey.id}
                    >
                      {revokingId === apiKey.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      {copy.revoke}
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
