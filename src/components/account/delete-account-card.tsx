'use client';

import { useState, useTransition } from 'react';
import { ExternalLink, Trash2, TriangleAlert, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Api } from '@/lib/api-client';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import type { AppLanguageCode } from '@/shared/constants/app-language';

type DeleteAccountCopy = {
  toastDeleted: string;
  title: string;
  description: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  charsRemaining: (remaining: number) => string;
  deleteButton: string;
  dialogTitle: string;
  dialogDescription: string;
  stripeNotice: string;
  stripeBlockedTitle: string;
  stripeBlockedDescription: string;
  openBillingPortal: string;
  genericDeleteFailed: string;
  cancel: string;
  deleting: string;
  confirmDelete: string;
};

const COPY: Record<AppLanguageCode, DeleteAccountCopy> = {
  en: {
    toastDeleted: 'Your YumCut account has been deleted.',
    title: 'Delete account',
    description: 'Removing your account permanently deletes all projects, custom characters, token history, and sessions. This action cannot be undone.',
    reasonLabel: 'Reason for leaving (optional)',
    reasonPlaceholder: "Let us know why you're leaving so we can improve YumCut.",
    charsRemaining: (remaining) => `${remaining} characters remaining`,
    deleteButton: 'Permanently delete account',
    dialogTitle: 'Delete your YumCut account?',
    dialogDescription: "This will immediately revoke access, remove every project, clear saved characters, and erase remaining tokens. You'll need to create a new account to use YumCut again.",
    stripeNotice: 'If you have an active web subscription, YumCut will cancel it in Stripe before deleting the account.',
    stripeBlockedTitle: 'Cancel your Stripe subscription first',
    stripeBlockedDescription: 'We could not cancel your Stripe subscription automatically, so your account was not deleted. Open Stripe Billing Portal, cancel the subscription manually, then return and delete the account again.',
    openBillingPortal: 'Open Stripe Billing Portal',
    genericDeleteFailed: 'Account was not deleted. Please try again.',
    cancel: 'Cancel',
    deleting: 'Deleting…',
    confirmDelete: 'Yes, delete everything',
  },
  ru: {
    toastDeleted: 'Ваш аккаунт ЯмКат удален.',
    title: 'Удаление аккаунта',
    description: 'Удаление аккаунта навсегда удалит все проекты, кастомных персонажей, историю токенов и сессии. Это действие нельзя отменить.',
    reasonLabel: 'Причина ухода (необязательно)',
    reasonPlaceholder: 'Расскажите, почему уходите, чтобы мы могли улучшить ЯмКат.',
    charsRemaining: (remaining) => `Осталось символов: ${remaining}`,
    deleteButton: 'Удалить аккаунт навсегда',
    dialogTitle: 'Удалить аккаунт ЯмКат?',
    dialogDescription: 'Доступ будет немедленно отозван, все проекты и сохранённые персонажи удалены, оставшиеся токены списаны. Для использования ЯмКат нужно будет создать новый аккаунт.',
    stripeNotice: 'Если у вас есть активная web-подписка, ЯмКат сначала отменит её в Stripe и только потом удалит аккаунт.',
    stripeBlockedTitle: 'Сначала отмените подписку Stripe',
    stripeBlockedDescription: 'Мы не смогли автоматически отменить подписку Stripe, поэтому аккаунт не был удалён. Откройте Stripe Billing Portal, отмените подписку вручную, затем вернитесь и повторите удаление аккаунта.',
    openBillingPortal: 'Открыть Stripe Billing Portal',
    genericDeleteFailed: 'Аккаунт не удалён. Попробуйте ещё раз.',
    cancel: 'Отмена',
    deleting: 'Удаляем…',
    confirmDelete: 'Да, удалить всё',
  },
};

export function DeleteAccountCard() {
  const { language } = useAppLanguage();
  const copy = COPY[language];
  const [reason, setReason] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [billingPortalUrl, setBillingPortalUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const trimmedReason = reason.trim();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        setBillingPortalUrl(null);
        const payload = trimmedReason.length ? { reason: trimmedReason } : undefined;
        const result = await Api.deleteAccount(payload, { showErrorToast: false });
        toast.success(result.message || copy.toastDeleted);
        setDialogOpen(false);
        setReason('');
        setBillingPortalUrl(null);
        try {
          await signOut({ callbackUrl: '/' });
        } catch {
          router.push('/');
        }
      } catch (err) {
        const apiError = err as {
          status?: number;
          error?: {
            code?: string;
            message?: string;
            details?: { portalUrl?: string | null };
          };
        };
        if (
          apiError.status === 409 &&
          apiError.error?.code === 'STRIPE_SUBSCRIPTION_CANCEL_REQUIRED'
        ) {
          setBillingPortalUrl(apiError.error.details?.portalUrl ?? null);
          toast.error(copy.stripeBlockedTitle, { description: copy.stripeBlockedDescription });
          return;
        }
        toast.error(copy.genericDeleteFailed, { description: apiError.error?.message });
        console.error('Account deletion failed', err);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="h-5 w-5" />
          <span>{copy.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-gray-600 dark:text-gray-300">
          {copy.description}
        </p>
        <div className="space-y-2">
          <Label htmlFor="delete-reason">{copy.reasonLabel}</Label>
          <Textarea
            id="delete-reason"
            value={reason}
            maxLength={512}
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder={copy.reasonPlaceholder}
            className="min-h-[90px]"
          />
          <p className="text-xs text-muted-foreground">{copy.charsRemaining(512 - reason.length)}</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setBillingPortalUrl(null);
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="destructive" className="cursor-pointer">
              <Trash2 className="mr-2 h-4 w-4" />
              {copy.deleteButton}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader className="flex-col items-start gap-2">
              <DialogTitle>{copy.dialogTitle}</DialogTitle>
              <DialogDescription>
                {copy.dialogDescription}
              </DialogDescription>
            </DialogHeader>
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {copy.stripeNotice}
            </p>
            {billingPortalUrl !== null ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
                <p className="font-semibold">{copy.stripeBlockedTitle}</p>
                <p className="mt-1">{copy.stripeBlockedDescription}</p>
                {billingPortalUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 cursor-pointer bg-white text-red-900 hover:bg-red-100 dark:bg-transparent dark:text-red-100 dark:hover:bg-red-900/30"
                    onClick={() => window.open(billingPortalUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {copy.openBillingPortal}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending} className="cursor-pointer">
                  <X className="mr-2 h-4 w-4" />
                  {copy.cancel}
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                className="cursor-pointer"
                disabled={isPending}
                onClick={handleDelete}
              >
                <TriangleAlert className="mr-2 h-4 w-4" />
                {isPending ? copy.deleting : copy.confirmDelete}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
