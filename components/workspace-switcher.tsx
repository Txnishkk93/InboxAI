'use client';

import { useRouter } from 'next/navigation';

type WorkspaceItem = {
  workspace: {
    id: string;
    name: string;
  };
};

export function WorkspaceSwitcher({
  currentWorkspaceId,
  workspaces,
  currentWorkspaceName,
}: {
  currentWorkspaceId: string;
  workspaces: WorkspaceItem[];
  currentWorkspaceName: string;
}) {
  const router = useRouter();

  if (workspaces.length <= 1) {
    return (
      <div 
        data-testid="workspace-switcher"
        className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 font-medium"
      >
        {currentWorkspaceName}
      </div>
    );
  }

  return (
    <select
      data-testid="workspace-switcher"
      value={currentWorkspaceId}
      onChange={(e) => {
        const id = e.target.value;
        router.push(`/${id}/overview`);
      }}
      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer transition hover:border-slate-600"
    >
      {workspaces.map((item) => (
        <option key={item.workspace.id} value={item.workspace.id}>
          {item.workspace.name}
        </option>
      ))}
    </select>
  );
}
