/**
 * supabase/functions/shared/systemdProvider.ts
 * ---------------------------------------------------------------------------
 * Running a model-written command on a machine that has other things to lose.
 *
 * LocalSandboxProvider spawns the command as whoever runs the worker, with no
 * ceiling on memory or CPU. Fine on a laptop, wrong on a server: the one this
 * targets has a single core, 1.9 GB, and three production backends already on
 * it. An unbounded `npm install` there does not fail politely — it takes the
 * other services with it.
 *
 * Docker would solve this and costs a couple of gigabytes. systemd is already
 * running, so `systemd-run` gives most of the same guarantees for nothing:
 *
 *   --uid              an account that owns nothing else on the box
 *   MemoryMax          a hard ceiling; the kernel kills this, not the host
 *   CPUQuota           leaves the machine responsive for what was here first
 *   TasksMax           a fork bomb is a plausible accident in generated code
 *   ProtectHome        /home and /root cease to exist for it
 *   ProtectSystem      everything outside the work directory is read-only
 *   PrivateTmp         its /tmp is its own and dies with it
 *   NoNewPrivileges    no way back up through a setuid binary
 *
 * Only the launch differs from the local provider — the directory layout, the
 * file transfer and the cleanup are identical, so this subclasses rather than
 * reimplements. Everything it overrides is one method.
 *
 * What it does *not* stop is network access, because `npm install` needs it.
 * That is a deliberate trade, not an oversight.
 * ---------------------------------------------------------------------------
 */

import { dirname } from "https://deno.land/std@0.218.2/path/mod.ts";
import { LocalSandboxProvider } from "./localProvider.ts";

/** Where sandboxes live. Must be writable by the account below. */
const ROOT = Deno.env.get("SANDBOX_ROOT") ?? "/var/lib/retrocode/work";
/** The account commands run as. Must own nothing else on the machine. */
const RUN_AS = Deno.env.get("SANDBOX_USER") ?? "retrocode";

/**
 * Hard ceiling per command.
 *
 * Sized against what is left after the services already on the box, not against
 * what the box has. Without it the kernel picks a victim by score when memory
 * runs out, and the biggest process is usually somebody else's server.
 */
const MEMORY_MAX = Deno.env.get("SANDBOX_MEMORY_MAX") ?? "512M";

/**
 * Share of one core.
 *
 * Below 100% on purpose: this machine has one, and a build that pins it makes
 * every other service on the host stop answering.
 */
const CPU_QUOTA = Deno.env.get("SANDBOX_CPU_QUOTA") ?? "60%";

export class SystemdSandboxProvider extends LocalSandboxProvider {
  constructor() {
    super(ROOT);
  }

  /** The command runs as another user, so it has to own its directory. */
  protected override onDirCreated(dir: string): void {
    new Deno.Command("chown", { args: ["-R", `${RUN_AS}:${RUN_AS}`, dir] }).outputSync();
    new Deno.Command("chmod", { args: ["-R", "u+rwX", dir] }).outputSync();
  }

  protected override buildCommand(commandStr: string, workDir: string): Deno.Command {
    // The sandbox root, not the working directory: a build writes to node_modules
    // beside the project, and ReadWritePaths has to cover the whole tree.
    const writable = this.root ?? workDir;

    // HOME has to be inside the writable area. Pointed at the sandbox user's
    // real home it was outside ReadWritePaths, so npm could not create ~/.npm
    // and every install died — reporting, misleadingly, "Invalid response body
    // while trying to fetch https://registry.npmjs.org/...". The agent read
    // that as a network problem and told the user the registry was
    // unreachable, when the actual error was ENOENT on mkdir.
    //
    // The sandbox's own home/user, which already exists and is disposed of
    // with the rest of it. dirname rather than a regex on the path: the
    // escaping is one place this has already gone wrong.
    const home = dirname(workDir);

    return new Deno.Command("systemd-run", {
      args: [
        // --pipe hands back the command's own output; --wait makes its exit
        // code ours rather than the launcher's.
        "--pipe", "--wait", "--collect", "--quiet",
        `--uid=${RUN_AS}`,
        `--property=MemoryMax=${MEMORY_MAX}`,
        `--property=CPUQuota=${CPU_QUOTA}`,
        "--property=TasksMax=128",
        "--property=PrivateTmp=yes",
        "--property=ProtectHome=yes",
        "--property=ProtectSystem=strict",
        "--property=ProtectKernelTunables=yes",
        "--property=NoNewPrivileges=yes",
        "--property=RestrictSUIDSGID=yes",
        `--property=ReadWritePaths=${writable}`,
        `--property=WorkingDirectory=${workDir}`,
        // The same allow-list the local provider uses, expressed the way
        // systemd-run takes it. HOME must exist for npm and must not be the
        // worker user's.
        `--setenv=PATH=${Deno.env.get("PATH") ?? "/usr/local/bin:/usr/bin:/bin"}`,
        `--setenv=HOME=${home}`,
        // npm respects this even when HOME moves, and keeping the cache in
        // the sandbox means one build cannot poison the next.
        `--setenv=npm_config_cache=${home}/.npm`,
        "--setenv=CI=1",
        "/bin/sh", "-c", commandStr,
      ],
      stdout: "piped",
      stderr: "piped",
    });
  }
}

/** True when this host can actually run the above. */
export function systemdSandboxAvailable(): boolean {
  if (Deno.build.os !== "linux") return false;
  try {
    return new Deno.Command("systemd-run", { args: ["--version"], stdout: "null", stderr: "null" })
      .outputSync().success;
  } catch {
    return false;
  }
}
