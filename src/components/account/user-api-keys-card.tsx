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
import { formatDateTime } from '@/lib/date';
import type { UserApiKeyListItem } from '@/server/user-api/api-keys';

type UserApiKeysCardProps = {
  initialKeys: UserApiKeyListItem[];
};

async function readJsonResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message || 'Request failed';
    throw new Error(message);
  }
  return body;
}

function formatMaybeDate(value: string | null) {
  if (!value) return null;
  try {
    return formatDateTime(value);
  } catch {
    return value;
  }
}

export function UserApiKeysCard({ initialKeys }: UserApiKeysCardProps) {
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
      toast.error('API key name is required');
      return;
    }
    const scopes = [
      ...(readEnabled ? ['read'] : []),
      ...(writeEnabled ? ['write'] : []),
    ];
    if (scopes.length === 0) {
      toast.error('Select at least one access level');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/account/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, scopes }),
      });
      const body = await readJsonResponse(response) as { key: string; item: UserApiKeyListItem };
      setKeys((current) => [body.item, ...current]);
      setCreatedKey(body.key);
      setName('');
      setReadEnabled(true);
      setWriteEnabled(true);
      toast.success('API key generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate API key');
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
      const body = await readJsonResponse(response) as { item: UserApiKeyListItem };
      setKeys((current) => current.map((key) => (key.id === id ? body.item : key)));
      toast.success('API key revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  };

  const copyCreatedKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    toast.success('API key copied');
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="inline-flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-500" />
            User API keys
          </CardTitle>
          <CardDescription>
            Create bearer keys for your account API. Plaintext keys are shown once.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{activeKeys.length.toLocaleString()} active</Badge>
          <Button asChild type="button" variant="outline" size="sm" className="cursor-pointer">
            <Link href="/api/user/v1/docs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Docs
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
            placeholder="Key name"
            maxLength={120}
            disabled={creating}
            aria-label="API key name"
          />
          <div className="flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
              <Checkbox
                checked={readEnabled}
                onCheckedChange={(checked) => setReadEnabled(checked === true)}
                disabled={creating}
              />
              Read
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
              <Checkbox
                checked={writeEnabled}
                onCheckedChange={(checked) => setWriteEnabled(checked === true)}
                disabled={creating}
              />
              Write
            </label>
            <Button type="button" className="cursor-pointer" onClick={() => void createKey()} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Generate
            </Button>
          </div>
        </div>

        {createdKey ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
              Copy this key now
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-auto rounded border border-amber-200 bg-white px-3 py-2 text-xs dark:border-amber-900 dark:bg-gray-950">
                {createdKey}
              </code>
              <Button type="button" className="cursor-pointer" variant="outline" onClick={() => void copyCreatedKey()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {keys.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-300">No API keys created yet.</p>
          ) : (
            keys.map((apiKey) => {
              const createdAt = formatMaybeDate(apiKey.createdAt);
              const lastUsedAt = formatMaybeDate(apiKey.lastUsedAt);
              const revokedAt = formatMaybeDate(apiKey.revokedAt);
              return (
                <div
                  key={apiKey.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{apiKey.name}</span>
                      {apiKey.revokedAt ? <Badge variant="danger">Revoked</Badge> : null}
                      {apiKey.scopes.includes('read') ? <Badge>Read</Badge> : null}
                      {apiKey.scopes.includes('write') ? <Badge>Write</Badge> : null}
                    </div>
                    <div className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                      Prefix: {apiKey.tokenPrefix}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Created {createdAt ?? apiKey.createdAt}
                      {lastUsedAt ? ` | Last used ${lastUsedAt}` : ''}
                      {revokedAt ? ` | Revoked ${revokedAt}` : ''}
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
                      Revoke
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
