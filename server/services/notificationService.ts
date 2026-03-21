import { storage } from "../storage";
import { db } from "../storage";
import { pendingNotifications } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface NotificationPayload {
  title: string;
  body: string;
  notificationType: "group_activity" | "rank_drop" | "rank_rise";
  data: Record<string, any>;
}

export class NotificationService {
  /**
   * Create a notification when someone uploads an activity to a shared group
   */
  async createGroupActivityNotification(
    recipientUserId: string,
    activityId: string,
    uploaderUsername: string,
    groupName: string,
    groupId: string,
    areaSqMeters: number
  ) {
    const areaM2 = Math.round(areaSqMeters / 1000); // Convert to thousands

    const notification: NotificationPayload = {
      title: `¡Espabílate, ${uploaderUsername}!`,
      body: `${uploaderUsername} ha subido una ruta en ${groupName}. ${areaM2}k m² pintados. ¿O le dejas todo el territorio?`,
      notificationType: "group_activity",
      data: {
        activityId,
        uploaderUsername,
        groupName,
        groupId,
        areaM2,
      },
    };

    await this.savePendingNotification(recipientUserId, groupId, notification);
  }

  /**
   * Create a notification when user loses rank (someone passed them)
   */
  async createRankDropNotification(
    userId: string,
    groupId: string | null,
    oldRank: number,
    newRank: number,
    usernameAhead: string,
    groupName: string
  ) {
    const notification: NotificationPayload = {
      title: "¡Perdiste la posición!",
      body: `¡Te has caído a la posición ${newRank}! ${usernameAhead} te ha adelantado... ¿te dejarás ganar tan fácil?? 🔥`,
      notificationType: "rank_drop",
      data: {
        oldRank,
        newRank,
        usernameAhead,
        groupName,
        groupId,
      },
    };

    await this.savePendingNotification(userId, groupId, notification);
  }

  /**
   * Create a notification when user gains rank (they passed someone)
   */
  async createRankRiseNotification(
    userId: string,
    groupId: string | null,
    oldRank: number,
    newRank: number,
    usernamePassed: string,
    groupName: string
  ) {
    const notification: NotificationPayload = {
      title: "¡Subiste en el ranking!",
      body: `¡Bien jugado! Ya eres #${newRank} en ${groupName}. ${usernamePassed} quedó atrás. ¡Sigue así! 🚀`,
      notificationType: "rank_rise",
      data: {
        oldRank,
        newRank,
        usernamePassed,
        groupName,
        groupId,
      },
    };

    await this.savePendingNotification(userId, groupId, notification);
  }

  /**
   * Save a notification to the database
   */
  private async savePendingNotification(
    userId: string,
    groupId: string | null,
    notification: NotificationPayload
  ) {
    try {
      await db.insert(pendingNotifications).values({
        userId,
        groupId: groupId || null,
        notificationType: notification.notificationType,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });
    } catch (err) {
      console.error("[Notifications] Error saving notification:", err);
    }
  }

  /**
   * Get pending notifications for a user (optionally filtered by group)
   */
  async getPendingNotifications(userId: string, groupId?: string) {
    try {
      let query = db
        .select()
        .from(pendingNotifications)
        .where(
          and(
            eq(pendingNotifications.userId, userId),
            eq(pendingNotifications.isDelivered, false),
            groupId ? eq(pendingNotifications.groupId, groupId) : undefined
          )
        );

      return await query;
    } catch (err) {
      console.error("[Notifications] Error fetching pending notifications:", err);
      return [];
    }
  }

  /**
   * Mark a notification as delivered
   */
  async markNotificationDelivered(notificationId: string) {
    try {
      await db
        .update(pendingNotifications)
        .set({
          isDelivered: true,
          deliveredAt: new Date(),
        })
        .where(eq(pendingNotifications.id, notificationId));
    } catch (err) {
      console.error("[Notifications] Error marking notification delivered:", err);
    }
  }

  /**
   * Get all undelivered notifications (for batch sending)
   */
  async getUndeliveredNotifications(limit: number = 1000) {
    try {
      return await db
        .select()
        .from(pendingNotifications)
        .where(eq(pendingNotifications.isDelivered, false))
        .limit(limit);
    } catch (err) {
      console.error("[Notifications] Error getting undelivered notifications:", err);
      return [];
    }
  }

  /**
   * Delete old delivered notifications (older than X days)
   */
  async cleanupOldNotifications(daysOld: number = 7) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      // In production, you'd want a proper DELETE query with where clause
      console.log(`[Notifications] Cleanup scheduled for notifications older than ${cutoffDate}`);
      // TODO: Implement cleanup if needed
    } catch (err) {
      console.error("[Notifications] Error cleaning up notifications:", err);
    }
  }
}

export const notificationService = new NotificationService();
