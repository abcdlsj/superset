import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

const scheduledFor = new Date("2026-08-06T18:46:00.000Z");
const terminalPendingNextRunAt = "2126-08-06T18:46:00.000Z";
const automationId = "75c82d06-77af-454c-9f0c-e6c617ea702b";
const dispatchAutomation = mock(async () => ({
	status: "dispatched" as const,
	runId: "3166c37c-add6-4382-ad07-44c816edb03e",
}));
const updateValues: unknown[] = [];
let failFinalization = false;

let automation = {
	id: automationId,
	enabled: true,
	nextRunAt: scheduledFor,
};

mock.module("@/env", () => ({
	env: {
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
		RELAY_URL: "https://relay.example.com",
		QSTASH_CURRENT_SIGNING_KEY: "current-key",
		QSTASH_NEXT_SIGNING_KEY: "next-key",
	},
}));

mock.module("@upstash/qstash", () => ({
	Receiver: class {
		verify = mock(async () => true);
	},
}));

mock.module("@superset/db/schema", () => ({
	automations: { id: "id" },
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
		update: () => ({
			set: (values: unknown) => {
				updateValues.push(values);
				return {
					where: async () => {
						if (failFinalization) {
							throw new Error("finalization failed");
						}
					},
				};
			},
		}),
	},
}));

mock.module("@superset/trpc/automation-dispatch", () => ({
	dispatchAutomation,
}));

mock.module("drizzle-orm", () => ({
	and: () => undefined,
	eq: () => undefined,
}));

const { POST } = await import("./route");

function request(payload: Record<string, unknown>): Request {
	return new Request(
		`http://localhost:3001/api/automations/dispatch/${automationId}`,
		{
			method: "POST",
			headers: { "upstash-signature": "valid-signature" },
			body: JSON.stringify(payload),
		},
	);
}

const params = Promise.resolve({ id: automationId });

describe("automations dispatch route", () => {
	beforeEach(() => {
		dispatchAutomation.mockClear();
		automation = {
			id: automationId,
			enabled: true,
			nextRunAt: scheduledFor,
		};
		updateValues.length = 0;
		failFinalization = false;
	});

	test("dispatches a terminal occurrence and then disables it", async () => {
		const response = await POST(
			request({
				automationId,
				scheduledFor: scheduledFor.toISOString(),
				terminal: true,
			}),
			{ params },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			outcome: {
				status: "dispatched",
				runId: "3166c37c-add6-4382-ad07-44c816edb03e",
			},
		});
		expect(dispatchAutomation).toHaveBeenCalledTimes(1);
		expect(updateValues).toEqual([{ enabled: false }]);
	});

	test("does not acknowledge when terminal finalization fails", async () => {
		failFinalization = true;
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(
				POST(
					request({
						automationId,
						scheduledFor: scheduledFor.toISOString(),
						terminal: true,
					}),
					{ params },
				),
			).rejects.toThrow("finalization failed");
			expect(dispatchAutomation).toHaveBeenCalledTimes(1);
		} finally {
			errorSpy.mockRestore();
		}
	});

	test("does not dispatch an automation intentionally disabled by the user", async () => {
		automation.enabled = false;

		const response = await POST(
			request({
				automationId,
				scheduledFor: scheduledFor.toISOString(),
			}),
			{ params },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			skipped: "disabled",
		});
		expect(dispatchAutomation).not.toHaveBeenCalled();
	});

	test("dispatches a terminal occurrence reserved by evaluate", async () => {
		automation.nextRunAt = new Date(terminalPendingNextRunAt);

		const response = await POST(
			request({
				automationId,
				scheduledFor: scheduledFor.toISOString(),
				terminal: true,
				terminalPendingNextRunAt,
			}),
			{ params },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			outcome: {
				status: "dispatched",
				runId: "3166c37c-add6-4382-ad07-44c816edb03e",
			},
		});
		expect(dispatchAutomation).toHaveBeenCalledTimes(1);
	});

	test("does not dispatch a terminal message after a user pause", async () => {
		automation.enabled = false;
		automation.nextRunAt = new Date(terminalPendingNextRunAt);

		const response = await POST(
			request({
				automationId,
				scheduledFor: scheduledFor.toISOString(),
				terminal: true,
				terminalPendingNextRunAt,
			}),
			{ params },
		);

		expect(await response.json()).toEqual({
			ok: true,
			skipped: "disabled",
		});
		expect(dispatchAutomation).not.toHaveBeenCalled();
	});

	test("skips a stale terminal occurrence", async () => {
		const response = await POST(
			request({
				automationId,
				scheduledFor: new Date(scheduledFor.getTime() - 60_000).toISOString(),
				terminal: true,
			}),
			{ params },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			skipped: "stale",
		});
		expect(dispatchAutomation).not.toHaveBeenCalled();
	});

	test("skips a terminal message for a different reservation", async () => {
		automation.nextRunAt = new Date("2126-08-07T18:46:00.000Z");

		const response = await POST(
			request({
				automationId,
				scheduledFor: scheduledFor.toISOString(),
				terminal: true,
				terminalPendingNextRunAt,
			}),
			{ params },
		);

		expect(await response.json()).toEqual({
			ok: true,
			skipped: "stale",
		});
		expect(dispatchAutomation).not.toHaveBeenCalled();
	});

	test("keeps dispatching enabled non-terminal occurrences", async () => {
		const response = await POST(
			request({
				automationId,
				scheduledFor: scheduledFor.toISOString(),
			}),
			{ params },
		);

		expect(response.status).toBe(200);
		expect(dispatchAutomation).toHaveBeenCalledTimes(1);
	});
});
