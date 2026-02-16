import type { Express, Request, Response } from "express";
// Try to require Stripe at runtime. Use eval to avoid static bundler resolution issues.
let Stripe: any = null;
try {
  // eslint-disable-next-line no-eval
  Stripe = eval("require")("stripe");
} catch (e) {
  console.warn("stripe package not available at build-time; runtime require will be attempted");
}
import { storage } from "./storage";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_GROUP_PRICE_ID = process.env.STRIPE_GROUP_PRICE_ID || "";
const APP_URL = process.env.APP_URL || "http://localhost:5000";

const stripe = Stripe ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" }) : null;

function genInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function createCheckoutSessionHandler(req: Request, res: Response) {
  try {
    const userId = req.session?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "No autorizado" });

    const { name } = req.body || {};

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: STRIPE_GROUP_PRICE_ID, quantity: 1 }],
      success_url: `${APP_URL}/groups/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/groups`,
      metadata: { userId, name: name || "" },
    });

    console.log(`[Stripe] Created checkout session ${session.id} for user ${userId}`);
    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("[Stripe] createCheckoutSession error:", err?.message || err);
    return res.status(500).json({ message: "Error creando sesión de pago" });
  }
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const raw = req.body as Buffer | undefined;
  if (!sig || !raw) {
    console.warn("[Stripe] Missing signature or raw body");
    return res.status(400).send("Missing signature or raw body");
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[Stripe] Webhook signature verification failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: skip if event already processed
  try {
    const exists = await storage.findStripeEventById(event.id);
    if (exists) {
      console.log(`[Stripe] Event ${event.id} already processed`);
      return res.status(200).send("ok");
    }
  } catch (e) {
    console.error("[Stripe] Error checking event idempotency", e);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const metadata = session.metadata || {};
        const userId = metadata.userId as string | undefined;
        const customer = session.customer as string | undefined;
        const subscription = session.subscription as string | undefined;

        if (!userId) {
          console.warn("[Stripe] checkout.session.completed missing userId metadata");
          break;
        }

        // Save customer id on user
        if (customer) {
          await storage.updateUserStripeCustomer(userId, customer);
        }

        // Create group and membership, using provided name if present in metadata
        const providedName = metadata.name && metadata.name.length > 0 ? metadata.name : null;

        let inviteCode = genInviteCode();
        let groupId: string | null = null;
        for (let i = 0; i < 5; i++) {
          try {
            const gid = await storage.createGroup(userId, providedName, inviteCode, subscription || null);
            groupId = gid;
            break;
          } catch (err: any) {
            console.warn("[Stripe] invite_code collision, retrying", err?.message || err);
            inviteCode = genInviteCode();
            continue;
          }
        }

        if (groupId) {
          await storage.addGroupMember(groupId, userId, "admin");
          console.log(`[Stripe] Created group ${groupId} for user ${userId}`);
        }

        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const subId = sub.id;
        // If subscription is canceled or unpaid, mark groups inactive
        const status = (sub.status || "").toLowerCase();
        if (status === "canceled" || status === "unpaid" || status === "incomplete") {
          await storage.markGroupsInactiveBySubscriptionId(subId);
          console.log(`[Stripe] Marked groups inactive for subscription ${subId}`);
        }
        break;
      }
      default:
        // ignore
        break;
    }

    // store event for idempotency/log
    try {
      await storage.insertStripeEvent(event.id, JSON.stringify(event));
    } catch (e) {
      console.error("[Stripe] Failed to store stripe event", e);
    }

    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("[Stripe] Webhook processing error:", err?.message || err);
    return res.status(500).send("internal error");
  }
}

export function registerStripeRoutes(app: Express) {
  // Mount webhook with raw body parser specifically for Stripe verification
  (app as any).post("/api/stripe/webhook", (req: any, res: any, next: any) => next());
}
