// Child-process tracking for worker threads, so a cooperative shutdown can
// SIGKILL + reap in-flight children before the thread exits. Needed because
// worker.terminate() destroys the thread's libuv process handles: any child
// still alive (or exited but not yet waited on) at that moment is never
// reaped and stays <defunct> under host-service until the process dies
// (issue #6152).
//
// Hooks ChildProcess.prototype.spawn — the one funnel every creation path
// uses (spawn/exec/execFile/fork, simple-git, promisified variants) — rather
// than the module-level functions, whose call sites capture bindings at
// import time. No-op on runtimes without that method (bun test).

import { ChildProcess } from "node:child_process";

const liveChildren = new Set<ChildProcess>();
let shuttingDown = false;

type SpawnFn = (this: ChildProcess, ...args: unknown[]) => unknown;

const proto = ChildProcess.prototype as unknown as { spawn?: SpawnFn };
const originalSpawn = proto.spawn;
if (typeof originalSpawn === "function") {
	proto.spawn = function (this: ChildProcess, ...args: unknown[]): unknown {
		const result = originalSpawn.apply(this, args);
		trackChild(this);
		return result;
	};
}

function trackChild(child: ChildProcess): void {
	// No pid = spawn failed; there is no OS process to reap.
	if (child.pid === undefined) return;
	liveChildren.add(child);
	child.once("exit", () => liveChildren.delete(child));
	if (shuttingDown) child.kill("SIGKILL");
}

/**
 * SIGKILL every live child and resolve once each has been reaped ('exit'
 * fires after libuv waits on the pid). Children spawned while shutting down
 * are killed on arrival and picked up by the next loop pass. A child wedged
 * in uninterruptible sleep can stall this — the runner's grace timeout
 * hard-terminates the worker in that case.
 */
export async function killAndReapTrackedChildren(): Promise<void> {
	shuttingDown = true;
	while (liveChildren.size > 0) {
		await Promise.all(
			[...liveChildren].map((child) => {
				if (child.exitCode !== null || child.signalCode !== null) {
					liveChildren.delete(child);
					return undefined;
				}
				return new Promise<void>((resolve) => {
					child.once("exit", () => resolve());
					child.kill("SIGKILL");
				});
			}),
		);
	}
}
