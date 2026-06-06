'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLES, ROLE_LABELS, type Role } from '@/app/lib/permissions';

interface PortalUserRow {
  id: number;
  username: string;
  role: Role;
  roleLabel: string;
  isActive: boolean;
}

const ROLE_OPTIONS = Object.values(ROLES);

export default function UsersPage() {
  const [users, setUsers] = useState<PortalUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>(ROLES.OPERATOR);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<Role>(ROLES.OPERATOR);
  const [editPassword, setEditPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/users', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not load users');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const response = await fetch('/api/v1/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        role: newRole,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || 'Failed to create user');
      return;
    }

    setMessage(`User ${newUsername} created.`);
    setNewUsername('');
    setNewPassword('');
    setNewRole(ROLES.OPERATOR);
    setShowCreate(false);
    void loadUsers();
  }

  async function handleUpdate(user: PortalUserRow) {
    setError(null);
    setMessage(null);

    const body: Record<string, unknown> = { role: editRole, isActive: user.isActive };
    if (editPassword.trim()) body.password = editPassword;

    const response = await fetch(`/api/v1/users/${user.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || 'Failed to update user');
      return;
    }

    setMessage(`User ${user.username} updated.`);
    setEditingId(null);
    setEditPassword('');
    void loadUsers();
  }

  async function toggleActive(user: PortalUserRow) {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/v1/users/${user.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || 'Failed to update user status');
      return;
    }

    setMessage(`User ${user.username} ${user.isActive ? 'deactivated' : 'activated'}.`);
    void loadUsers();
  }

  async function handleDelete(user: PortalUserRow) {
    if (!window.confirm(`Delete user ${user.username}? This cannot be undone.`)) return;

    setError(null);
    setMessage(null);

    const response = await fetch(`/api/v1/users/${user.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || 'Failed to delete user');
      return;
    }

    setMessage(`User ${user.username} deleted.`);
    void loadUsers();
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create portal users and assign roles with permission-based access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : 'Add user'}
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <div key={role} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-xs text-slate-500">
              {role === ROLES.ADMIN && 'Full access including users and audit logs.'}
              {role === ROLES.OPERATOR && 'Can read/write bank details and post payments.'}
              {role === ROLES.VIEWER && 'Read-only access to bank details, payments, and queues.'}
            </p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            New user
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Username</span>
              <input
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Role</span>
              <select
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as Role)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="mt-4 rounded-lg bg-[#f26522] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e05a1c]"
          >
            Create user
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Username</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.username}</td>
                  <td className="px-4 py-3">
                    {editingId === user.id ? (
                      <select
                        value={editRole}
                        onChange={(event) => setEditRole(event.target.value as Role)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-700">{user.roleLabel}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {editingId === user.id ? (
                        <>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(event) => setEditPassword(event.target.value)}
                            placeholder="New password (optional)"
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => void handleUpdate(user)}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditPassword('');
                            }}
                            className="rounded-lg px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(user.id);
                              setEditRole(user.role);
                              setEditPassword('');
                            }}
                            className="rounded-lg px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(user)}
                            className="rounded-lg px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {/* <button
                            type="button"
                            onClick={() => void handleDelete(user)}
                            className="rounded-lg px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button> */}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
