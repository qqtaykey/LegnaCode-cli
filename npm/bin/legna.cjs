#!/usr/bin/env node
"use strict";

var os = require("os");
var path = require("path");
var childProcess = require("child_process");

var PLATFORMS = {
  "darwin-arm64": "@legna-lnc/legnacode-darwin-arm64",
  "darwin-x64": "@legna-lnc/legnacode-darwin-x64",
  "linux-x64": "@legna-lnc/legnacode-linux-x64",
  "linux-arm64": "@legna-lnc/legnacode-linux-arm64",
  "win32-x64": "@legna-lnc/legnacode-win32-x64",
};

var key = process.platform + "-" + os.arch();
var pkg = PLATFORMS[key];

if (!pkg) {
  console.error(
    "legna: unsupported platform " + key + "\n" +
    "Supported: " + Object.keys(PLATFORMS).join(", ")
  );
  process.exit(1);
}

var bin;
try {
  var binName = process.platform === "win32" ? "legna.exe" : "bin/legna";
  bin = path.resolve(require.resolve(pkg + "/package.json"), "..", binName);
} catch (e) {
  console.error(
    "legna: could not find platform package " + pkg + "\n" +
    "Try reinstalling: npm install -g @legna-lnc/legnacode"
  );
  process.exit(1);
}

var result = childProcess.spawnSync(bin, process.argv.slice(2), {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  if (result.error.code === "EACCES") {
    require("fs").chmodSync(bin, 0o755);
    result = childProcess.spawnSync(bin, process.argv.slice(2), {
      stdio: "inherit",
      env: process.env,
    });
  } else {
    console.error("legna: " + result.error.message);
    process.exit(1);
  }
}

process.exit(result.status === null ? 1 : result.status);
