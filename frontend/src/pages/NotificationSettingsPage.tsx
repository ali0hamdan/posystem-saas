import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, BellRing, Loader2 } from 'lucide-react';
import {
  fetchNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreference,
  type UpdateNotificationPreferenceBody,
} from '@/api/notification-preferences.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { ErrorBanner } from '@/components/ui/error-banner';

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-line text-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === 'OWNER';

  const prefsQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreference,
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationPreference[]>(
        ['notification-preferences'],
        (old) =>
          old?.map((p) => (p.notificationType === updated.notificationType ? updated : p)) ?? old,
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not save notification setting'));
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  function patch(
    pref: NotificationPreference,
    changes: Partial<Omit<UpdateNotificationPreferenceBody, 'notificationType'>>,
  ) {
    if (!isOwner) return;
    // Optimistic update for snappy toggles.
    queryClient.setQueryData<NotificationPreference[]>(
      ['notification-preferences'],
      (old) =>
        old?.map((p) =>
          p.notificationType === pref.notificationType ? { ...p, ...changes, isDefault: false } : p,
        ) ?? old,
    );
    mutation.mutate({ notificationType: pref.notificationType, ...changes });
  }

  const prefs = prefsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div>
        <div className="flex items-center gap-2">
          <BellRing className="h-6 w-6 text-primary-500" />
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Notification Settings
          </h1>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Choose who receives email notifications for important business events.
          {!isOwner && ' Only the owner can change these settings.'}
        </p>
      </div>

      {prefsQuery.isError ? (
        <ErrorBanner message={getApiErrorMessage(prefsQuery.error, 'Could not load notification settings.')} />
      ) : prefsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3">Notification</th>
                <th className="px-3 py-3 text-center">Enabled</th>
                <th className="px-3 py-3 text-center">Owner</th>
                <th className="px-3 py-3 text-center">General Manager</th>
                <th className="px-3 py-3 text-center">Co-Manager</th>
              </tr>
            </thead>
            <tbody>
              {prefs.map((p) => {
                const noRecipients =
                  p.enabled &&
                  !p.sendToOwner &&
                  !p.sendToGeneralManager &&
                  !p.sendToCoManager &&
                  p.selectedUserIds.length === 0;
                return (
                  <tr key={p.notificationType} className="border-b border-line/60 last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{p.label}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{p.description}</p>
                      {noRecipients ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          No recipients selected. This notification will not be sent.
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Toggle
                        checked={p.enabled}
                        disabled={!isOwner}
                        onChange={(v) => patch(p, { enabled: v })}
                        label={`Enable ${p.label}`}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Toggle
                        checked={p.sendToOwner}
                        disabled={!isOwner || !p.enabled}
                        onChange={(v) => patch(p, { sendToOwner: v })}
                        label={`Send ${p.label} to owner`}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Toggle
                        checked={p.sendToGeneralManager}
                        disabled={!isOwner || !p.enabled}
                        onChange={(v) => patch(p, { sendToGeneralManager: v })}
                        label={`Send ${p.label} to general manager`}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Toggle
                        checked={p.sendToCoManager}
                        disabled={!isOwner || !p.enabled}
                        onChange={(v) => patch(p, { sendToCoManager: v })}
                        label={`Send ${p.label} to co-manager`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        Notifications are emailed only to active users of your business with verified email
        addresses. Legacy Admin accounts receive General Manager notifications; legacy Manager
        accounts receive Co-Manager notifications.
      </p>
    </div>
  );
}
