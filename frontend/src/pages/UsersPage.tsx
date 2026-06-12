import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, DollarSign, KeyRound, Pencil, UserPlus, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fetchUsers, updateUserStatus } from '@/api/users.api';
import { fetchRoleMeta } from '@/api/permissions.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { formatRoleLabel } from '@/lib/format-user';
import { CreateUserModal } from '@/features/users/CreateUserModal';
import { EditUserModal } from '@/features/users/EditUserModal';
import { ResetPasswordModal } from '@/features/users/ResetPasswordModal';
import { CommissionSettingsModal } from '@/features/users/CommissionSettingsModal';
import { Button } from '@/components/ui/button';
import type { AdminUser } from '@/types/users-admin';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const canCreateUsers = can('users:create');
  const canUpdateUsers = can('users:update');
  const canDeactivateUsers = can('users:deactivate');
  const canResetPassword = can('users:reset_password');
  const canManageCommission = can('commissions:manage_settings');
  const isOwner = me?.role === 'OWNER';

  const rolesQuery = useQuery({
    queryKey: ['permissions', 'roles'],
    queryFn: fetchRoleMeta,
  });

  const assignableRoles = useMemo(() => {
    const roles = rolesQuery.data ?? [];
    if (isOwner) return roles;
    return roles.filter((r) => r.role !== 'OWNER');
  }, [rolesQuery.data, isOwner]);

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUsername, setResetUsername] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [commissionUser, setCommissionUser] = useState<AdminUser | null>(null);
  const [commissionOpen, setCommissionOpen] = useState(false);

  const listParams = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);

  const usersQuery = useQuery({
    queryKey: ['users', listParams],
    queryFn: () => fetchUsers(listParams),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUserStatus(id, { isActive }),
    onSuccess: (_, v) => {
      toast.success(v.isActive ? 'User activated' : 'User deactivated');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not update status'));
    },
  });

  const rows = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 0;

  const createRoles = useMemo(
    () => assignableRoles.filter((r) => r.role !== 'OWNER' || isOwner),
    [assignableRoles, isOwner],
  );

  function openEdit(u: AdminUser) {
    setEditUser(u);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditUser(null);
  }

  function openReset(u: AdminUser) {
    setResetUserId(u.id);
    setResetUsername(u.username);
    setResetOpen(true);
  }

  function closeReset() {
    setResetOpen(false);
    setResetUserId(null);
    setResetUsername(null);
  }

  function openCommission(u: AdminUser) {
    setCommissionUser(u);
    setCommissionOpen(true);
  }

  function closeCommission() {
    setCommissionOpen(false);
    setCommissionUser(null);
  }

  function confirmToggleActive(u: AdminUser) {
    if (u.isActive) {
      if (!window.confirm(`Deactivate ${u.username}? They will not be able to sign in.`)) return;
    }
    statusMutation.mutate({ id: u.id, isActive: !u.isActive });
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Users</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {canCreateUsers
              ? 'Create and manage staff accounts for your store.'
              : 'View staff accounts. Contact an owner or manager to create new users.'}
          </p>
        </div>
        {canCreateUsers ? (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="self-start"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Create user
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
        {usersQuery.isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-ink-muted">Loading users…</div>
        ) : usersQuery.isError ? (
          <div className="px-4 py-10 text-center text-sm text-danger-700">
            {getApiErrorMessage(usersQuery.error, 'Could not load users.')}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void usersQuery.refetch()}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Salesman ID</th>
                  <th className="px-4 py-3">Approval ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-ink-muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
                    <tr key={u.id} className="border-b border-line transition-colors hover:bg-canvas-raised/60">
                      <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink">{u.username}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-ink-muted" title={u.email ?? ''}>
                        {u.email ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-ink">{formatRoleLabel(u.role)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {u.role === 'SALESMAN' ? u.salesmanIdCode ?? '—' : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                        {u.role === 'GENERAL_MANAGER' || u.role === 'CO_MANAGER'
                          ? u.approvalIdCode ?? '—'
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.isActive ? 'success' : 'muted'}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDate(u.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {canUpdateUsers ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEdit(u)}
                              className="h-8 px-2"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Edit
                            </Button>
                          ) : null}
                          {canResetPassword ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openReset(u)}
                              className="h-8 px-2"
                            >
                              <KeyRound className="h-3.5 w-3.5" aria-hidden />
                              Password
                            </Button>
                          ) : null}
                          {canManageCommission && u.role === 'SALESMAN' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openCommission(u)}
                              className="h-8 px-2"
                            >
                              <DollarSign className="h-3.5 w-3.5" aria-hidden />
                              Commission
                            </Button>
                          ) : null}
                          {canDeactivateUsers ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={statusMutation.isPending || (u.id === me?.id && u.isActive)}
                              onClick={() => confirmToggleActive(u)}
                              className="h-8 px-2"
                              title={u.id === me?.id && u.isActive ? 'You cannot deactivate your own account' : undefined}
                            >
                              {u.isActive ? (
                                <>
                                  <UserX className="h-3.5 w-3.5" aria-hidden />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                                  Activate
                                </>
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta && totalPages > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-muted sm:flex-row">
            <p>
              Page {meta.page} of {totalPages} · {meta.total} users
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || usersQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} roleOptions={createRoles} />

      <EditUserModal
        user={editUser}
        open={editOpen}
        onClose={closeEdit}
        canChangeRole={isOwner && canUpdateUsers}
        roleOptions={assignableRoles}
      />

      <ResetPasswordModal userId={resetUserId} username={resetUsername} open={resetOpen} onClose={closeReset} />

      <CommissionSettingsModal user={commissionUser} open={commissionOpen} onClose={closeCommission} />
    </div>
  );
}
