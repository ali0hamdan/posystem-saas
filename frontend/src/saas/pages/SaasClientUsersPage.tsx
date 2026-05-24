import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, DataTableShell, Td, Th } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { createClientUser, deleteClientUser, fetchClientUsers, patchClientUser, patchClientUserPassword, patchClientUserStatus } from '@/saas/api/saas-clients.api';
import { getSaasApiErrorMessage } from '@/saas/api/saas-client';
import { SaasCard } from '@/saas/components/SaasCard';
import { SaasEmptyTable, SaasQueryError, SaasTableSkeleton } from '@/saas/components/SaasQueryState';
import { SaasStatusBadge } from '@/saas/components/SaasStatusBadge';
import { useSaasPermissions } from '@/saas/hooks/use-saas-permissions';
import type { CreateClientUserBody, PatchClientUserBody, SaasClientUser } from '@/saas/types';

type UserFormState = {
  name: string;
  username: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'CASHIER';
  branchId: string;
  isActive: boolean;
  password: string;
};

const EMPTY_FORM: UserFormState = {
  name: '',
  username: '',
  email: '',
  role: 'CASHIER',
  branchId: '',
  isActive: true,
  password: '',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function SaasClientUsersPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const perms = useSaasPermissions();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SaasClientUser | null>(null);
  const [resetPassUser, setResetPassUser] = useState<SaasClientUser | null>(null);
  const [statusUser, setStatusUser] = useState<SaasClientUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SaasClientUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [newPassword, setNewPassword] = useState('');

  const usersQ = useQuery({
    queryKey: ['saas', 'clients', id, 'users', search],
    queryFn: () => fetchClientUsers(id, { page: 1, limit: 100, q: search || undefined, includeInactive: true }),
    enabled: Boolean(id) && perms.canViewClientUsers,
  });

  const users = usersQ.data?.data ?? [];

  const createM = useMutation({
    mutationFn: (body: CreateClientUserBody) => createClientUser(id, body),
    onSuccess: () => {
      toast.success('User created');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id, 'users'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e, 'Could not create user')),
  });

  const editM = useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: PatchClientUserBody }) => patchClientUser(id, userId, body),
    onSuccess: () => {
      toast.success('User updated');
      setEditUser(null);
      setForm(EMPTY_FORM);
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id, 'users'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e, 'Could not update user')),
  });

  const resetPassM = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => patchClientUserPassword(id, userId, password),
    onSuccess: () => {
      toast.success('Password reset');
      setResetPassUser(null);
      setNewPassword('');
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e, 'Could not reset password')),
  });

  const statusM = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => patchClientUserStatus(id, userId, isActive),
    onSuccess: () => {
      toast.success('User status updated');
      setStatusUser(null);
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id, 'users'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e, 'Could not update user status')),
  });

  const deleteM = useMutation({
    mutationFn: (userId: string) => deleteClientUser(id, userId),
    onSuccess: () => {
      toast.success('User deactivated');
      setDeleteUser(null);
      void qc.invalidateQueries({ queryKey: ['saas', 'clients', id, 'users'] });
    },
    onError: (e) => toast.error(getSaasApiErrorMessage(e, 'Could not deactivate user')),
  });

  const notAvailable = useMemo(() => {
    if (!usersQ.isError) return false;
    const msg = getSaasApiErrorMessage(usersQ.error, '');
    return msg.includes('404') || msg.toLowerCase().includes('not found');
  }, [usersQ.isError, usersQ.error]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const openEdit = (u: SaasClientUser) => {
    setForm({
      name: u.name,
      username: u.username,
      email: u.email ?? '',
      role: u.role,
      branchId: u.branchId ?? '',
      isActive: u.isActive,
      password: '',
    });
    setEditUser(u);
  };

  const validateForm = (withPassword: boolean): boolean => {
    if (!form.name.trim() || !form.username.trim()) {
      toast.error('Name and username are required');
      return false;
    }
    if (withPassword && form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    return true;
  };

  return (
    <SaasCard
      title="Client users"
      action={
        perms.canManageClientUsers ? (
          <Button size="sm" variant="primary" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add user
          </Button>
        ) : null
      }
    >
      {!perms.canViewClientUsers ? (
        <EmptyState
          icon={Users}
          title="No access to user management"
          description="Your SaaS role cannot view tenant user accounts."
          className="border-line bg-surface-muted"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex max-w-sm gap-2">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, email…"
            />
          </div>

          {usersQ.isLoading ? <SaasTableSkeleton rows={6} /> : null}
          {usersQ.isError && !notAvailable ? (
            <SaasQueryError message={getSaasApiErrorMessage(usersQ.error)} onRetry={() => usersQ.refetch()} />
          ) : null}
          {usersQ.isError && notAvailable ? (
            <EmptyState
              icon={Users}
              title="User management API not available"
              description="SaaS endpoint /saas/clients/:clientId/users is missing or disabled on this backend."
              className="border-line bg-surface-muted"
            />
          ) : null}
          {usersQ.isSuccess && users.length === 0 ? (
            <SaasEmptyTable title="No users found" description="Create a user for this client to grant dashboard access." />
          ) : null}

          {users.length > 0 ? (
            <DataTableShell>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Username</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Branch</Th>
                    <Th>Status</Th>
                    <Th>Created at</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <Td>{u.name}</Td>
                      <Td className="font-mono text-xs">{u.username}</Td>
                      <Td>{u.email ?? '—'}</Td>
                      <Td>{u.role}</Td>
                      <Td>{u.branchName ?? '—'}</Td>
                      <Td>
                        <SaasStatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </Td>
                      <Td>{formatDate(u.createdAt)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {perms.canManageClientUsers ? (
                            <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                              Edit
                            </Button>
                          ) : null}
                          {perms.canResetClientUserPassword ? (
                            <Button variant="ghost" size="sm" onClick={() => setResetPassUser(u)}>
                              Reset password
                            </Button>
                          ) : null}
                          {perms.canManageClientUsers ? (
                            <Button variant="ghost" size="sm" onClick={() => setStatusUser(u)}>
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          ) : null}
                          {perms.canManageClientUsers ? (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteUser(u)}>
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableShell>
          ) : null}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Create user"
        description="Create a store user under this client."
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={createM.isPending}
              onClick={() => {
                if (!validateForm(true)) return;
                createM.mutate({
                  name: form.name.trim(),
                  username: form.username.trim().toLowerCase(),
                  email: form.email.trim() || undefined,
                  password: form.password,
                  role: form.role,
                  branchId: form.branchId.trim() || undefined,
                  isActive: form.isActive,
                });
              }}
            >
              {createM.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="u-name">Name</FieldLabel>
            <TextInput id="u-name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="u-username">Username</FieldLabel>
            <TextInput id="u-username" value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="u-email">Email</FieldLabel>
            <TextInput id="u-email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="u-role">Role</FieldLabel>
            <SelectInput id="u-role" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as UserFormState['role'] }))}>
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="CASHIER">CASHIER</option>
            </SelectInput>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="u-branch">Branch ID (optional)</FieldLabel>
            <TextInput id="u-branch" value={form.branchId} onChange={(e) => setForm((s) => ({ ...s, branchId: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="u-password">Password</FieldLabel>
            <TextInput id="u-password" type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editUser)}
        title="Edit user"
        description="Update user profile and role."
        onClose={() => setEditUser(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={editM.isPending}
              onClick={() => {
                if (!editUser || !validateForm(false)) return;
                editM.mutate({
                  userId: editUser.id,
                  body: {
                    name: form.name.trim(),
                    username: form.username.trim().toLowerCase(),
                    email: form.email.trim() || undefined,
                    role: form.role,
                    branchId: form.branchId.trim() || undefined,
                    isActive: form.isActive,
                  },
                });
              }}
            >
              {editM.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="eu-name">Name</FieldLabel>
            <TextInput id="eu-name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="eu-username">Username</FieldLabel>
            <TextInput id="eu-username" value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="eu-email">Email</FieldLabel>
            <TextInput id="eu-email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="eu-role">Role</FieldLabel>
            <SelectInput id="eu-role" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as UserFormState['role'] }))}>
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="CASHIER">CASHIER</option>
            </SelectInput>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="eu-branch">Branch ID (optional)</FieldLabel>
            <TextInput id="eu-branch" value={form.branchId} onChange={(e) => setForm((s) => ({ ...s, branchId: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetPassUser)}
        title="Reset password"
        description={resetPassUser ? `Set a new password for ${resetPassUser.username}.` : undefined}
        onClose={() => {
          setResetPassUser(null);
          setNewPassword('');
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setResetPassUser(null);
                setNewPassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={resetPassM.isPending}
              onClick={() => {
                if (!resetPassUser) return;
                if (newPassword.length < 8) {
                  toast.error('Password must be at least 8 characters');
                  return;
                }
                resetPassM.mutate({ userId: resetPassUser.id, password: newPassword });
              }}
            >
              {resetPassM.isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </div>
        }
      >
        <div>
          <FieldLabel htmlFor="reset-pass">New password</FieldLabel>
          <TextInput id="reset-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(statusUser)}
        title={statusUser?.isActive ? 'Deactivate user?' : 'Activate user?'}
        description={
          statusUser?.isActive
            ? 'The user will no longer be able to log in.'
            : 'The user will be able to log in again.'
        }
        confirmLabel={statusUser?.isActive ? 'Deactivate' : 'Activate'}
        loading={statusM.isPending}
        variant={statusUser?.isActive ? 'danger' : 'primary'}
        onCancel={() => setStatusUser(null)}
        onConfirm={() => {
          if (!statusUser) return;
          statusM.mutate({ userId: statusUser.id, isActive: !statusUser.isActive });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteUser)}
        title="Deactivate user?"
        description="This performs a soft delete by setting user status to inactive."
        confirmLabel="Deactivate"
        loading={deleteM.isPending}
        variant="danger"
        onCancel={() => setDeleteUser(null)}
        onConfirm={() => {
          if (!deleteUser) return;
          deleteM.mutate(deleteUser.id);
        }}
      />
    </SaasCard>
  );
}
