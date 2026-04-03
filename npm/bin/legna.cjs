#!/usr/bin/env node
"use strict";

var os = require("os");
var path = require("path");
var fs = require("fs");
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

var binName = process.platform === "win32" ? "legna.exe" : "bin/legna";
var bin = null;

// Strategy 1: require.resolve (standard npm nested node_modules)
try {
  bin = path.resolve(require.resolve(pkg + "/package.json"), "..", binName);
} catch (e) {}

// Strategy 2: sibling in global node_modules (npm global flat layout)
if (!bin || !fs.existsSync(bin)) {
  var globalFlat = path.resolve(__dirname, "..", "..", pkg.replace("@legna-lnc/", "@legna-lnc" + path.sep), binName);
  if (fs.existsSync(globalFlat)) bin = globalFlat;
}

// Strategy 3: nested node_modules inside our own package
if (!bin || !fs.existsSync(bin)) {
  var nested = path.resolve(__dirname, "..", "..", "node_modules", pkg, binName);
  if (fs.existsSync(nested)) bin = nested;
}

if (!bin || !fs.existsSync(bin)) {
  console.error(
    "legna: could not find platform package " + pkg + "\n" +
    "Try: npm install -g " + pkg
  );
  process.exit(1);
}

var result = childProcess.spawnSync(bin, process.argv.slice(2), {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  if (result.error.code === "EACCES") {
    fs.chmodSync(bin, 0o755);
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
