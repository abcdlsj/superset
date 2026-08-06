import { dbWs } from "@superset/db/client";
import { automations } from "@superset/db/schema";
import { dispatchAutomation } from "@superset/trpc/automation-dispatch";
import { Receiver } from "@upstash/qstash";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const receiver = new Receiver({
	currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
	nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

const payloadSchema = z.object({
	automationId: z.string().uuid(),
	scheduledFor: z.string().datetime(),
	// Keep terminal provenance in the signed message so this handler can
	// finalize recurrence exhaustion after the dispatch attempt.
	terminal: z.boolean().default(false),
});

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
): Promise<Response> {
	const body = await request.text();
	const signature = request.headers.get("upstash-signature");
	if (!signature) {
		return Response.json({ error: "Missing signature" }, { status: 401 });
	}

	const { id } = await params;
	const valid = await receiver.verify({
		body,
		signature,
		url: `${env.NEXT_PUBLIC_API_URL}/api/automations/dispatch/${id}`,
	});
	if (!valid) {
		return Response.json({ error: "Invalid signature" }, { status: 401 });
	}

	const parsed = payloadSchema.safeParse(JSON.parse(body));
	if (!parsed.success) {
		console.error("[automations/dispatch] invalid payload", parsed.error);
		return Response.json({ error: "Invalid payload" }, { status: 400 });
	}

	const [automation] = await dbWs
		.select()
		.from(automations)
		.where(eq(automations.id, parsed.data.automationId))
		.limit(1);

	if (!automation) {
		return Response.json({ ok: true, skipped: "deleted" });
	}

	const scheduledFor = new Date(parsed.data.scheduledFor);
	if (!automation.enabled) {
		return Response.json({ ok: true, skipped: "disabled" });
	}
	if (
		parsed.data.terminal &&
		bucketToMinute(automation.nextRunAt).getTime() !==
			bucketToMinute(scheduledFor).getTime()
	) {
		return Response.json({ ok: true, skipped: "stale" });
	}

	const outcome = await dispatchAutomation({
		automation,
		scheduledFor,
		relayUrl: env.RELAY_URL,
	});

	if (parsed.data.terminal) {
		try {
			await finalizeTerminalAutomation(automation.id, automation.nextRunAt);
		} catch (error) {
			console.error(
				"[automations/dispatch] failed to finalize terminal automation",
				{ automationId: automation.id, error },
			);
			// The dispatcher already recorded the outcome. Return non-2xx so
			// QStash retries this idempotent finalization before acknowledging the
			// message; run-failed preserves any already-terminal run outcome.
			throw error;
		}
	}

	return Response.json({ ok: true, outcome });
}

async function finalizeTerminalAutomation(
	automationId: string,
	nextRunAt: Date,
): Promise<void> {
	await dbWs
		.update(automations)
		.set({ enabled: false })
		.where(
			and(
				eq(automations.id, automationId),
				eq(automations.enabled, true),
				eq(automations.nextRunAt, nextRunAt),
			),
		);
}

function bucketToMinute(date: Date): Date {
	const copy = new Date(date.getTime());
	copy.setUTCSeconds(0, 0);
	return copy;
}
