// Probe the per-user macOS services that PTY descendants depend on.
//
// A daemon can keep accepting socket connections while its Mach bootstrap
// namespace is no longer able to reach opendirectoryd or trustd. In that
// state `id -un` falls back to printing the numeric uid and Go's platform TLS
// verifier returns OSStatus -26276. Both checks are deliberately local to the
// daemon process: probing them in host-service would only describe the parent
// process's namespace.

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { DaemonContextStatus } from "./protocol/messages.ts";

export type ContextCheckStatus = "healthy" | "degraded" | "unknown";

export interface DaemonContextProbe {
	status: DaemonContextStatus;
	userLookup: ContextCheckStatus;
	trustd: ContextCheckStatus;
}

export interface SecurityProbeResult {
	status: number | null;
	error?: unknown;
}

export interface ContextProbeDeps {
	platform?: NodeJS.Platform;
	userInfo?: () => { username: string; uid: number };
	readBundle?: () => string | Promise<string>;
	runSecurity?: (
		certPath: string,
	) => SecurityProbeResult | Promise<SecurityProbeResult>;
	tmpDir?: string;
	uid?: number;
}

const SYSTEM_CERT_BUNDLE = "/etc/ssl/cert.pem";
const BEGIN_CERTIFICATE = "-----BEGIN CERTIFICATE-----";
const END_CERTIFICATE = "-----END CERTIFICATE-----";
const SECURITY_PROBE_TIMEOUT_MS = 3_000;

/**
 * Return a conservative context result. An inconclusive probe is `unknown`,
 * never `degraded`: adoption must not destroy live sessions because a local
 * diagnostic command is unavailable or timed out.
 */
export async function probeDaemonContext(
	deps: ContextProbeDeps = {},
): Promise<DaemonContextProbe> {
	const platform = deps.platform ?? process.platform;
	if (platform !== "darwin") {
		return {
			status: "healthy",
			userLookup: "healthy",
			trustd: "healthy",
		};
	}

	const userLookup = probeUserLookup(deps);
	const trustd = await probeTrustd(deps);
	return {
		status: combineStatuses(userLookup, trustd),
		userLookup,
		trustd,
	};
}

function probeUserLookup(deps: ContextProbeDeps): ContextCheckStatus {
	try {
		const userInfo = deps.userInfo ?? (() => os.userInfo());
		const info = userInfo();
		const uid = deps.uid ?? process.getuid?.() ?? info.uid;
		// A degraded libinfo lookup can return the numeric uid as the username
		// when opendirectoryd is unreachable. That is the exact `id -un` failure
		// reported by the issue.
		if (!info.username || info.username === String(info.uid)) return "degraded";
		if (info.uid !== uid) return "degraded";
		return "healthy";
	} catch {
		return "degraded";
	}
}

async function probeTrustd(
	deps: ContextProbeDeps,
): Promise<ContextCheckStatus> {
	let certDir: string | undefined;
	try {
		const bundle = deps.readBundle
			? await deps.readBundle()
			: await fs.readFile(SYSTEM_CERT_BUNDLE, "utf8");
		const begin = bundle.indexOf(BEGIN_CERTIFICATE);
		const end = bundle.indexOf(END_CERTIFICATE, begin);
		if (begin === -1 || end === -1) return "unknown";

		// Use an unpredictable owner-only directory. The certificate is only a
		// known-good input for the verifier; the result is about trustd reachability.
		certDir = await fs.mkdtemp(
			path.join(deps.tmpDir ?? os.tmpdir(), "superset-trustd-"),
		);
		const certPath = path.join(certDir, "probe.pem");
		await fs.writeFile(
			certPath,
			`${bundle.slice(begin, end + END_CERTIFICATE.length)}\n`,
			{ mode: 0o600 },
		);

		const runSecurity =
			deps.runSecurity ??
			((inputPath: string): Promise<SecurityProbeResult> =>
				new Promise((resolve) => {
					execFile(
						"security",
						["verify-cert", "-c", inputPath],
						{ timeout: SECURITY_PROBE_TIMEOUT_MS, maxBuffer: 64 * 1024 },
						(error) => {
							if (!error) {
								resolve({ status: 0 });
								return;
							}
							const code = (error as { code?: string | number }).code;
							const status = typeof code === "number" ? code : null;
							resolve({
								status,
								error: status === null ? error : undefined,
							});
						},
					);
				}));
		const result = await runSecurity(certPath);
		if (result.error || result.status === null) return "unknown";
		return result.status === 0 ? "healthy" : "degraded";
	} catch {
		return "unknown";
	} finally {
		if (certDir) {
			try {
				await fs.rm(certDir, { recursive: true, force: true });
			} catch {
				// Best effort; the directory is owner-only and contains no secrets.
			}
		}
	}
}

function combineStatuses(
	userLookup: ContextCheckStatus,
	trustd: ContextCheckStatus,
): DaemonContextStatus {
	if (userLookup === "degraded" || trustd === "degraded") return "degraded";
	if (userLookup === "unknown" || trustd === "unknown") return "unknown";
	return "healthy";
}
