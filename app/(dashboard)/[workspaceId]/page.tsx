import { redirect } from 'next/navigation';

export default function WorkspaceRootPage({ params }: { params: { workspaceId: string } }) {
  redirect(`/${params.workspaceId}/overview`);
}
