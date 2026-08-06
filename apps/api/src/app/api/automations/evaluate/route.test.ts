import { describe, expect, mock, test } from "bun:test";
import { nextOccurrenceAfter } from "@superset/shared/rrule";

const terminalOccurrence = new Date(Date.now() - 60_000);
const nonTerminalOccurrence = new Date(Date.now() - 86_400_000);
const automationId = "75c82d06-77af-454c-9f0c-e6c617ea702b";

let dueAutomations: Array<{
	id: string;
	nextRunAt: Date;
	rrule: string;
	dtstart: Date;
	timezone: string;
}> = [];
const updateValues: unknown[] = [];
const batchJSON = mock(async (_messages: unknown[]) => undefined);

mock.module("@/env", () => ({
	env: {
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
		QSTASH_TOKEN: "test-token",
		QSTASH_URL: "https://qstash.example.com",
		QSTASH_CURRENT_SIGNING_KEY: "current-key",
		QSTASH_NEXT_SIGNING_KEY: "next-key",
	},
}));

mock.module("@upstash/qstash", () => ({
	Client: class {
		batchJSON = batchJSON;
	},
	Receiver: class {
		verify = mock(async () => true);
	},
}));

mock.module("@superset/db/schema", () => ({
	automations: {
		enabled: "enabled",
		nextRunAt: "nextRunAt",
	},
}));

mock.module("@superset/db/client", () => ({
	dbWs: {
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: () => ({
						limit: async () => dueAutomations,
					}),
				}),
			}),
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
	lte: () => undefined,
}));

const { POST } = await import("./route");

type EnqueuedMessage = {
	body: {
		automationId: string;
		scheduledFor: string;
		terminal: boolean;
	};
};

function request(): Request {
	return new Request("http://localhost:3001/api/automations/evaluate", {
		method: "POST",
		headers: { "upstash-signature": "valid-signature" },
		body: "{}",
	});
}

describe("automations evaluate route", () => {
	test("marks a COUNT=1 occurrence as terminal in the queued payload", async () => {
		dueAutomations = [
			{
				id: automationId,
				nextRunAt: terminalOccurrence,
				rrule: "FREQ=DAILY;COUNT=1",
				dtstart: terminalOccurrence,
				timezone: "UTC",
			},
		];
		updateValues.length = 0;
		batchJSON.mockClear();

		const response = await POST(request());

		expect(response.status).toBe(200);
		expect(batchJSON).toHaveBeenCalledTimes(1);
		const messages = batchJSON.mock.calls[0]?.[0] as EnqueuedMessage[];
		expect(messages[0]?.body).toEqual({
			automationId,
			scheduledFor: new Date(
				Math.floor(terminalOccurrence.getTime() / 60_000) * 60_000,
			).toISOString(),
			terminal: true,
		});
		expect(updateValues).toEqual([{ enabled: false }]);
	});

	test("keeps the existing non-terminal advance path", async () => {
		dueAutomations = [
			{
				id: automationId,
				nextRunAt: nonTerminalOccurrence,
				rrule: "FREQ=DAILY",
				dtstart: nonTerminalOccurrence,
				timezone: "UTC",
			},
		];
		updateValues.length = 0;
		batchJSON.mockClear();

		const response = await POST(request());

		expect(response.status).toBe(200);
		const messages = batchJSON.mock.calls[0]?.[0] as EnqueuedMessage[];
		expect(messages[0]?.body.terminal).toBe(false);
		expect(updateValues).toEqual([
			{
				nextRunAt: nextOccurrenceAfter({
					rrule: "FREQ=DAILY",
					dtstart: nonTerminalOccurrence,
					timezone: "UTC",
					after: nonTerminalOccurrence,
				}),
			},
		]);
	});
});
