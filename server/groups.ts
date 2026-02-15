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
