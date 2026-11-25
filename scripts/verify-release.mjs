import fs from "node:fs";
import net from "node:net";
import dns from "node:dns";
import tls from "node:tls";
import dgram from "node:dgram";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(filename), "..");

if (process.env.RELEASE_VERIFY_GUARD === "true") {
  const environmentFile = (file) =>
    /(?:^|[\\/])\.env(?:$|\.)/.test(String(file));
  const deniedFile = () =>
    Object.assign(new Error("Release verification blocks dotenv files"), {
      code: "ENOENT",
    });

  for (const method of ["readFileSync", "openSync", "createReadStream"]) {
    const original = fs[method];
    fs[method] = function (file, ...args) {
      if (environmentFile(file)) throw deniedFile();
      return original.call(this, file, ...args);
    };
  }

  for (const method of ["readFile", "open"]) {
    const original = fs[method];
    fs[method] = function (file, ...args) {
      if (!environmentFile(file)) return original.call(this, file, ...args);
      const callback = args.at(-1);
      if (typeof callback === "function") {
        return process.nextTick(callback, deniedFile());
      }
      throw deniedFile();
    };
    const promised = fs.promises[method];
    fs.promises[method] = async function (file, ...args) {
      if (environmentFile(file)) throw deniedFile();
      return promised.call(this, file, ...args);
    };
  }

  const allowedHost = (host) =>
    process.env.RELEASE_VERIFY_STEP === "build" &&
    ["fonts.googleapis.com", "fonts.gstatic.com"].includes(host);

  const checkHost = (host) => {
    if (!allowedHost(host)) {
      throw new Error("Release verification blocks network access");
    }
  };

  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const options = Array.isArray(args[0]) ? args[0][0] : args[0];
    checkHost(
      typeof options === "object" ? options.host || options.servername : args[1]
    );
    return connect.apply(this, args);
  };

  const tlsConnect = tls.connect;
  tls.connect = function (...args) {
    const options = args.find((value) => value && typeof value === "object");
    checkHost(options?.host || options?.servername || args[1]);
    return tlsConnect.apply(this, args);
  };

  for (const lookup of [dns, dns.promises]) {
    const original = lookup.lookup;
    lookup.lookup = function (host, ...args) {
      checkHost(host);
      return original.call(this, host, ...args);
    };
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = function (input, ...args) {
    const url =
      typeof input === "string" || input instanceof URL ? input : input.url;
    checkHost(new URL(url).hostname);
    return originalFetch.call(this, input, ...args);
  };

  for (const method of ["send", "connect"]) {
    dgram.Socket.prototype[method] = () => checkHost("");
  }

  syncBuiltinESMExports();
} else {
  const step = process.argv[2];
  const testFiles = process.argv.slice(3);
  const unitTestPath =
    /^tests\/unit\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.test\.tsx?$/;

  if (
    !["units", "types", "build"].includes(step) ||
    (step !== "units" && testFiles.length > 0) ||
    testFiles.some((file) => !unitTestPath.test(file))
  ) {
    throw new Error(
      "Usage: node scripts/verify-release.mjs units [tests/unit/<name>.test.ts|tsx ...] OR types|build (no extra arguments)"
    );
  }

  const environment = {};
  for (const name of [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "HOME",
    "TEMP",
    "TMP",
    "LOCALAPPDATA",
    "APPDATA",
  ]) {
    const key = Object.keys(process.env).find(
      (item) => item.toLowerCase() === name.toLowerCase()
    );
    if (key) environment[name] = process.env[key];
  }

  Object.assign(environment, {
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: step === "units" ? "test" : "production",
    DATABASE_URL:
      "postgres://verification:verification_dummy_only@127.0.0.1:1/harpy_radar_unit_test",
    APP_TIMEZONE: "America/Caracas",
    SOURCE_BAHIA_ENABLED: "false",
    SOURCE_RIOMARKET_ENABLED: "false",
    SOURCE_FARMATODO_ENABLED: "false",
    SOURCE_CENTRAL_MADEIRENSE_ENABLED: "false",
    SOURCE_PUNTO_AL_MAYOR_ENABLED: "false",
    SOURCE_GAMA_ENABLED: "false",
  });

  const guardedEnvironment = {
    ...environment,
    RELEASE_VERIFY_GUARD: "true",
    RELEASE_VERIFY_STEP: step,
    NODE_OPTIONS: `--import="${import.meta.url}"`,
  };

  const run = (command, args, timeout, env = guardedEnvironment) => {
    const visibleArgs = args.map((argument) =>
      argument.includes("\n") ? "<inspection>" : argument
    );
    console.log(
      `VERIFY ${step}: ${command === process.execPath ? "node" : command} ${visibleArgs.join(" ")}`
    );
    const result = spawnSync(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
      timeout,
    });
    if (result.error || result.status !== 0) {
      throw new Error(
        `Verification failed (${result.error?.code || result.status || result.signal})`
      );
    }
  };

  if (step === "units") {
    const safety = String.raw`
      const assert = require("node:assert/strict"), fs = require("node:fs"), net = require("node:net");
      assert.throws(() => fs.readFileSync(".env.release-verification-probe"), /Release verification blocks dotenv files/);
      assert.throws(() => new net.Socket().connect(1, "127.0.0.1"), /Release verification blocks network access/);
      assert.throws(() => fetch("https://example.invalid"), /Release verification blocks network access/);
      console.log("VERIFY guard: dotenv, TCP and fetch blocked");
    `;
    run(process.execPath, ["-e", safety], 30_000);
    run(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "vitest.unit.config.ts",
        "--reporter",
        "dot",
        "--silent=true",
        ...testFiles,
      ],
      180_000
    );
  } else if (step === "types") {
    for (const config of ["tsconfig.json", "tsconfig.test.json"]) {
      run(
        process.execPath,
        [
          "node_modules/typescript/bin/tsc",
          "--noEmit",
          "--incremental",
          "false",
          "-p",
          config,
        ],
        180_000
      );
    }
  } else {
    run(
      process.execPath,
      ["node_modules/next/dist/bin/next", "build", "--webpack"],
      600_000
    );
  }

  console.log(`VERIFY ${step}: PASS`);
}
