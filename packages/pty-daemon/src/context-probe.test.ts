import { describe, expect, test } from "bun:test";
import { probeDaemonContext } from "./context-probe.ts";

const CERT_BUNDLE =
	"-----BEGIN CERTIFICATE-----\nCERT\n-----END CERTIFICATE-----\n";

describe("probeDaemonContext", () => {
	test("does not run macOS probes on other platforms", async () => {
		const result = await probeDaemonContext({
			platform: "linux",
			userInfo: () => {
				throw new Error("must not be called");
			},
		});

		expect(result).toEqual({
			status: "healthy",
			userLookup: "healthy",
			trustd: "healthy",
		});
	});

	test("marks a numeric username as degraded", async () => {
		const result = await probeDaemonContext({
			platform: "darwin",
			uid: 501,
			userInfo: () => ({ username: "501", uid: 501 }),
			readBundle: () => CERT_BUNDLE,
			runSecurity: () => ({ status: 0 }),
		});

		expect(result).toEqual({
			status: "degraded",
			userLookup: "degraded",
			trustd: "healthy",
		});
	});

	test("marks trustd as degraded on a verifier failure", async () => {
		const result = await probeDaemonContext({
			platform: "darwin",
			uid: 501,
			userInfo: () => ({ username: "alice", uid: 501 }),
			readBundle: () => CERT_BUNDLE,
			runSecurity: () => ({ status: 1 }),
		});

		expect(result).toEqual({
			status: "degraded",
			userLookup: "healthy",
			trustd: "degraded",
		});
	});

	test("does not report degraded when the verifier is inconclusive", async () => {
		const result = await probeDaemonContext({
			platform: "darwin",
			uid: 501,
			userInfo: () => ({ username: "alice", uid: 501 }),
			readBundle: () => CERT_BUNDLE,
			runSecurity: () => ({ status: null, error: new Error("timeout") }),
		});

		expect(result).toEqual({
			status: "unknown",
			userLookup: "healthy",
			trustd: "unknown",
		});
	});
});
