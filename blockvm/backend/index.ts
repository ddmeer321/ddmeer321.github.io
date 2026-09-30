import { db, error, json, requireAuth, router } from '@appdeploy/sdk';

interface ProjectRecord {
  name: string;
  workspace: string;
  createdAt: string;
}

const allowedWorkspaces = new Set([
  'scratch', 'lubuntu', 'android', 'reactos', 'arch', 'windows98', 'freedos',
  'firefox', 'code', 'jupyter', 'excalidraw', 'blockly', 'sqlite',
  'libreoffice', 'krita', 'audacity', 'godot', 'blender', 'vmception',
]);

const tableFor = (userId: string) => 'projects:' + userId;

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'GET /api/me': [
    requireAuth(),
    async (ctx) => json({ userId: ctx.user!.userId, email: ctx.user!.email, name: ctx.user!.name }),
  ],

  'GET /api/projects': [
    requireAuth(),
    async (ctx) => {
      const { items } = await db.list<ProjectRecord>(tableFor(ctx.user!.userId), { limit: 50 });
      const projects = items.map((item) => ({ id: item.id, name: item.name, workspace: item.workspace, createdAt: item.createdAt })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ projects });
    },
  ],

  'POST /api/projects': [
    requireAuth(),
    async (ctx) => {
      const body = ctx.body as { name?: unknown; workspace?: unknown };
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const workspace = typeof body?.workspace === 'string' ? body.workspace : '';
      if (!name || name.length > 80) return error('Projektname muss 1 bis 80 Zeichen lang sein.', 400);
      if (!allowedWorkspaces.has(workspace)) return error('Ungültiger Workspace-Typ.', 400);
      const record: ProjectRecord = { name, workspace, createdAt: new Date().toISOString() };
      const [id] = await db.add(tableFor(ctx.user!.userId), [record]);
      if (!id) return error('Projekt konnte nicht gespeichert werden.', 500);
      return json({ project: { id, ...record } }, 201);
    },
  ],

  'DELETE /api/projects/:id': [
    requireAuth(),
    async (ctx) => {
      const id = ctx.params.id;
      if (!id) return error('Projekt-ID fehlt.', 400);
      const [deleted] = await db.delete(tableFor(ctx.user!.userId), [id]);
      if (!deleted) return error('Projekt nicht gefunden.', 404);
      return json({ deleted: true });
    },
  ],
});
