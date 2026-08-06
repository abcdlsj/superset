import { dbWs } from "@superset/db/client";
import { automations } from "@superset/db/schema";
import { nextOccurrenceAfter } from "@superset/shared/rrule";
import { Client, Receiver } from "@upstash/qstash";
import { and, eq, lte } from "drizzle-orm";

import { env } from "@/env";

export const dynamic = "force-dynamic";

const qstash = new Client({
	token: env.QSTASH_TOKEN,
	baseUrl: env.QSTASH_URL,
});
const receiver = new Receiver({
	currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
	nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

const BATCH_SIZE = 2000;
// Keep the reservation occurrence-specific so a delayed message cannot claim
// a later terminal occurrence for the same automation.
const TERMINAL_PENDING_OFFSET_MS = 100 * 365 * 24 * 60 * 60 * 1000;

function reserveTerminalNextRunAt(occurrenceAt: Date): Date {
	return new Date(occurrenceAt.getTime() + TERMINAL_PENDING_OFFSET_MS);
}

function bucketToMinute(d: Date): Date {
	const copy = new Date(d.getTime());
	copy.setUTCSeconds(0, 0);
	return copy;
}

export async function POST(request: Request): Promise<Response> {
	const body = await request.text();
	const signature = request.headers.get("upstash-signature");
	if (!signature) {
		return Response.json({ error: "Missing signature" }, { status: 401 });
	}

	const valid = await receiver.verify({
		body,
		signature,
		url: `${env.NEXT_PUBLIC_API_URL}/api/automations/evaluate`,
	});
	if (!valid) {
		return Response.json({ error: "Invalid signature" }, { status: 401 });
	}

	const now = new Date();
	const due = await dbWs
		.select()
		.from(automations)
		.where(and(eq(automations.enabled, true), lte(automations.nextRunAt, now)))
		.orderBy(automations.nextRunAt)
		.limit(BATCH_SIZE);

	if (due.length === 0) {
		return Response.json({ enqueued: 0 });
	}

	const dueWithNext = due.map((automation) => {
		const next = nextOccurrenceAfter({
			rrule: automation.rrule,
			dtstart: automation.dtstart,
			timezone: automation.timezone,
			after: automation.nextRunAt,
		});
		return {
			automation,
			next,
			terminalPendingNextRunAt:
				next === null
					? reserveTerminalNextRunAt(automation.nextRunAt)
					: undefined,
		};
	});

	await qstash.batchJSON(
		dueWithNext.map(({ automation, next, terminalPendingNextRunAt }) => {
			const scheduledFor = bucketToMinute(automation.nextRunAt);
			return {
				url: `${env.NEXT_PUBLIC_API_URL}/api/automations/dispatch/${automation.id}`,
				body: {
					automationId: automation.id,
					scheduledFor: scheduledFor.toISOString(),
					terminal: next === null,
					terminalPendingNextRunAt: terminalPendingNextRunAt?.toISOString(),
				},
				deduplicationId: `${automation.id}_${scheduledFor.getTime()}`,
				retries: 2,
				failureCallback: `${env.NEXT_PUBLIC_API_URL}/api/automations/run-failed`,
			};
		}),
	);

	const advanceResults = await Promise.allSettled(
		dueWithNext.map(({ automation, next }) => {
			if (!next) {
				// Move the terminal occurrence out of the due window while its signed
				// QStash message is pending. The CAS prevents a pause or schedule edit
				// from being overwritten here.
				return dbWs
					.update(automations)
					.set({ nextRunAt: reserveTerminalNextRunAt(automation.nextRunAt) })
					.where(
						and(
							eq(automations.id, automation.id),
							eq(automations.enabled, true),
							eq(automations.nextRunAt, automation.nextRunAt),
						),
					);
			}

			return dbWs
				.update(automations)
				.set({ nextRunAt: next })
				.where(eq(automations.id, automation.id));
		}),
	);

	// next_run_at advance failures are recoverable (next tick re-enqueues and
	// QStash dedup absorbs the duplicate), but a persistent failure would
	// hide itself without this log.
	const advanceFailures = advanceResults.flatMap((result, index) => {
		if (result.status !== "rejected") return [];
		const automation = due[index];
		return [{ automationId: automation?.id, reason: result.reason }];
	});
	if (advanceFailures.length > 0) {
		console.error(
			"[automations/evaluate] advanceNextRun failures",
			advanceFailures,
		);
	}

	return Response.json({
		enqueued: due.length,
		advanceFailed: advanceFailures.length,
	});
}
