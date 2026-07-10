'use client';

import { useState } from 'react';
import { emitReticleSignal } from '@/app/reticle-dev';

type MemberItem = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  email: string | null;
  name: string | null;
};

type UserInfo = {
  id: string;
  email: string | null;
  name: string | null;
};

export function TeamDashboard({
  workspaceId,
  initialMembers,
  currentUser,
  currentUserRole,
}: {
  workspaceId: string;
  initialMembers: MemberItem[];
  currentUser: UserInfo;
  currentUserRole: string;
}) {
  const [members, setMembers] = useState<MemberItem[]>(initialMembers);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized = currentUserRole === 'owner' || currentUserRole === 'admin';
  const ownersCount = members.filter((m) => m.role === 'owner').length;

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteEmail.trim() || !inviteRole) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/memberships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite member');
      }

      // Check if user is already in members list to prevent duplicates visually
      const exists = members.some((m) => m.userId === data.userId);
      if (exists) {
        setMembers((current) =>
          current.map((m) => (m.userId === data.userId ? { ...m, role: data.role } : m))
        );
        setMessage('Member role updated successfully.');
      } else {
        // Fetch users updated list
        const res = await fetch(`/api/workspaces/${workspaceId}/memberships`);
        // If route does not support GET, build a new formatted object
        const newMember: MemberItem = {
          id: data.id,
          userId: data.userId,
          role: data.role,
          createdAt: data.createdAt,
          email: inviteEmail.trim().toLowerCase(),
          name: inviteEmail.trim().split('@')[0],
        };
        setMembers((current) => [...current, newMember]);
        setMessage('Member invited successfully.');
      }

      setInviteEmail('');
      setInviteRole('member');
      setShowInviteForm(false);
      // Emit member invited signal
      await emitReticleSignal('member:invited', { email: inviteEmail.trim(), role: inviteRole });
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/memberships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role: newRole,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      setMembers((current) =>
        current.map((m) => (m.userId === userId ? { ...m, role: data.role } : m))
      );
      setMessage('Role updated successfully.');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmRemove() {
    if (!confirmRemoveId) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/memberships/${confirmRemoveId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      setMembers((current) => current.filter((m) => m.id !== confirmRemoveId));
      setMessage('Member removed from active workspace.');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setConfirmRemoveId(null);
      setLoading(false);
    }
  }

  function formatDate(isoString: string) {
    const d = new Date(isoString);
    return (
      d.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }

  function isSoleOwner(member: MemberItem) {
    return member.role === 'owner' && ownersCount <= 1;
  }

  return (
    <div className="space-y-6 font-sans select-none">
      {message ? (
        <div className="rounded-md border border-border bg-surface-alt px-4 py-3 text-sm text-ink font-mono tracking-tight flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-ink-muted hover:text-ink font-semibold">&times;</button>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-accent-critical/20 bg-surface px-4 py-3 text-sm text-accent-critical font-mono tracking-tight flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-accent-critical hover:text-accent-critical/80 font-semibold">&times;</button>
        </div>
      ) : null}

      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-serif font-normal text-ink tracking-tight">Workspace Membership</h3>
            <p className="text-sm text-ink-muted mt-1 font-mono uppercase tracking-wider text-[11px]">
              Manage who has access to the current workspace and their role
            </p>
          </div>
          {isAuthorized && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              data-testid="invite-member-btn"
              className="rounded-md bg-ink text-surface px-5 py-2 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95 border border-transparent"
            >
              {showInviteForm ? 'Cancel Invite' : 'Invite Member'}
            </button>
          )}
        </div>
      </div>

      {/* Invite Form */}
      {showInviteForm && isAuthorized && (
        <form onSubmit={handleInvite} className="rounded-xl border border-border bg-surface-alt p-6 space-y-4">
          <div>
            <h4 className="text-base font-semibold text-ink">Invite Workspace Member</h4>
            <p className="text-xs text-ink-muted font-mono uppercase mt-0.5 tracking-wider">
              Add user access by email and assign role
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_200px_140px]">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              required
              className="rounded-md border border-border bg-surface px-4 py-2.5 text-base text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px]"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink min-h-[44px] cursor-pointer"
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={loading || !inviteEmail.trim()}
              className="rounded-md bg-ink text-surface px-6 py-2.5 text-sm font-semibold tracking-wide shadow transition hover:bg-ink-muted disabled:opacity-60 min-h-[44px] active:scale-95"
            >
              Invite
            </button>
          </div>
        </form>
      )}

      {/* Members table */}
      <div className="rounded-xl border border-border bg-surface-alt p-6">
        <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted mb-4 border-b border-border pb-3">
          MEMBERS MATRIX
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse select-text">
            <thead>
              <tr className="border-b border-border/80 font-mono text-xs uppercase text-ink-muted">
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Joined Date</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === currentUser.id;
                const disableRoleEdit = !isAuthorized || isSoleOwner(member);
                const disableRemoval = !isAuthorized || isSelf && isSoleOwner(member);

                return (
                  <tr
                    key={member.id}
                    className="border-b border-border/60 hover:bg-surface transition-colors duration-150 group"
                  >
                    <td className="py-4 px-4">
                      <div className="font-sans font-medium text-ink text-sm">
                        {member.name || 'Invited User'}
                      </div>
                      <div className="font-mono text-xs text-ink-muted mt-0.5">
                        {member.email} {isSelf && <span className="text-[10px] text-ink-muted font-bold">(YOU)</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs">
                      {disableRoleEdit ? (
                        <span className={`capitalize ${member.role === 'owner' ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
                          {member.role}
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                          className="bg-surface border border-border rounded px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:ring-1 focus:ring-ink cursor-pointer"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-ink-muted">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {disableRemoval ? (
                        isSelf && isSoleOwner(member) ? (
                          <span className="text-[10px] text-ink-muted font-mono font-semibold uppercase px-2">
                            Sole Owner
                          </span>
                        ) : (
                          <span className="text-[10px] text-ink-muted font-mono uppercase px-2">—</span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(member.id)}
                          className="text-accent-critical font-bold uppercase tracking-wider text-xs hover:underline min-h-[44px] px-2"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4">
          <div className="rounded-xl border border-border bg-surface-alt p-6 max-w-md w-full shadow-lg space-y-4">
            <div>
              <h4 className="text-base font-semibold text-ink font-serif tracking-tight">Remove Member</h4>
              <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                Are you sure you want to remove this member from the workspace? They will lose access immediately.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="rounded border border-border bg-surface-alt px-4 py-2 text-xs font-mono font-semibold uppercase text-ink-muted hover:text-ink hover:border-border-strong transition min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="rounded bg-accent-critical text-surface px-4 py-2 text-xs font-mono font-semibold uppercase hover:bg-accent-critical/90 transition min-h-[44px]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
