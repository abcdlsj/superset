import { beforeEach, expect, mock, test } from "bun:test";

const automationId = "75c82d06-77af-454c-9f0c-e6c617ea702b";
const terminalOccurrence = new Date("2026-08-06T18:46:30.000Z");
const scheduledFor = new Date("2026-08-06T18:46:00.000Z");
const terminalPendingNextRunAt = new Date(
	terminalOccurrence.getTime() + 100 * 365 * 24 * 60 * 60 * 1000,
);
const insertValues: unknown[] = [];
const updateValues: unknown[] = [];

const automation = {
	organizationId: "3ee200f3-c54c-46b1-b8b8-24a7f27348f3",
	name: "Nightly automation",
	enabled: true,
	nextRunAt: terminalPendingNextRunAt,
};

beforeEach(() => {
	insertValues.length = 0;
	updateValues.length = 0;
});

mock.module("@/env", () => ({
	env: {
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
		QSTASH_CURRENT_SIGNING_KEY: "current-key",
		QSTASH_NEXT_SIGNING_KEY: "next-key",
	},
}));

mock.module("@sentry/nextjs", () => ({
	captureException: mock(() => undefined),
}));

mock.module("@upstash/qstash", () => ({
	Receiver: class {
		verify = mock(async () => true);
	},
}));

mock.module("@superset/db/schema", () => ({
	automations: {
		id: "id",
		organizationId: "organizationId",
		name: "name",
		enabled: "enabled",
		nextRunAt: "nextRunAt",
	},
	automationRuns: {
		automationId: "automationId",
		organizationId: "organizationId",
		scheduledFor: "scheduledFor",
		status: "status",
	},
}));

mock.module("@superset/db/client", () => ({
	dbWs: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => [automation],
				}),
			}),
		}),
		insert: () => ({
			values: (values: unknown) => {
				insertValues.push(values);
				return {
					onConflictDoUpdate: async () => undefined,
				};
			},
		}),
		update: () => ({
			set: (values: unknown) => {
				updateValues.push(values);
				return { where: async () => undefined };
			},
		}),
	},
}));

mock.module("drizzle-orm", () => ({
	and: () => undefined,
	eq: () => undefined,
}));

const { POST } = await import("./route");

test("records a terminal delivery failure and closes the recurrence", async () => {
	const sourceBody = Buffer.from(
		JSON.stringify({
			automationId,
			scheduledFor: scheduledFor.toISOString(),
			terminal: true,
			terminalPendingNextRunAt: terminalPendingNextRunAt.toISOString(),
		}),
	).toString("base64");
	const request = new Request(
		"http://localhost:3001/api/automations/run-failed",
		{
			method: "POST",
			headers: { "upstash-signature": "valid-signature" },
			body: JSON.stringify({
				sourceMessageId: "qstash-message-id",
				sourceBody,
				status: 500,
				error: "delivery failed",
			}),
		},
	);

	const response = await POST(request);

	expect(response.status).toBe(200);
	expect(insertValues).toEqual([
		expect.objectContaining({
			automationId,
			status: "dispatch_failed",
			scheduledFor,
		}),
	]);
	expect(updateValues).toEqual([{ enabled: false }]);
});
