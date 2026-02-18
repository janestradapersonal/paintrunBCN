import type { Request, Response } from "express";
import { storage } from "./storage";

export async function getMyGroupsHandler(req: Request, res: Response) {
  const userId = req.session?.userId as string | undefined;
  if (!userId) return res.status(401).json({ message: "No autorizado" });

  try {
    const groups = await storage.getGroupsForUser(userId);
    return res.json(groups);
  } catch (err: any) {
    console.error("[Groups] getMyGroups error:", err?.message || err);
    return res.status(500).json({ message: "Error obteniendo grupos" });
  }
}

export async function joinGroupHandler(req: Request, res: Response) {
  const userId = req.session?.userId as string | undefined;
  if (!userId) return res.status(401).json({ message: "No autorizado" });

  const { inviteCode } = req.body || {};
  if (!inviteCode || typeof inviteCode !== "string") return res.status(400).json({ message: "inviteCode requerido" });

  try {
    const group = await storage.findGroupByInviteCode(inviteCode);
    if (!group) return res.status(404).json({ message: "Grupo no encontrado" });

    await storage.addGroupMember(group.id, userId, "member");
    const groups = await storage.getGroupsForUser(userId);
    return res.json({ group, groups });
  } catch (err: any) {
    console.error("[Groups] joinGroup error:", err?.message || err);
    return res.status(500).json({ message: "Error uniendo al grupo" });
  }
}

export async function setGroupNameHandler(req: Request, res: Response) {
  const userId = req.session?.userId as string | undefined;
  if (!userId) return res.status(401).json({ message: "No autorizado" });

  const groupId = req.params.id;
  const { name } = req.body || {};
  if (!groupId) return res.status(400).json({ message: "groupId required" });
  if (!name || typeof name !== "string") return res.status(400).json({ message: "name required" });

  try {
    // TODO: could verify the user is admin/owner; for now assume membership implies rights
    await storage.updateGroupName(groupId, name);
    const groups = await storage.getGroupsForUser(userId);
    return res.json({ success: true, groups });
  } catch (err: any) {
    console.error("[Groups] setGroupName error:", err?.message || err);
    return res.status(500).json({ message: "Error actualizando nombre" });
  }
}

export async function leaveGroupHandler(req: Request, res: Response) {
  const userId = req.session?.userId as string | undefined;
  if (!userId) return res.status(401).json({ message: "No autorizado" });

  const { groupId } = req.body || {};
  if (!groupId || typeof groupId !== 'string') return res.status(400).json({ message: 'groupId required' });

  try {
    await storage.removeGroupMember(groupId, userId);
    const groups = await storage.getGroupsForUser(userId);
    return res.json({ success: true, groups });
  } catch (err: any) {
    console.error('[Groups] leaveGroup error:', err?.message || err);
    return res.status(500).json({ message: 'Error saliendo del grupo' });
  }
}
