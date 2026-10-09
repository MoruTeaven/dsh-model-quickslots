import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const outDir = "lib";
const isWatch = process.argv.includes("--watch");

fs.mkdirSync(outDir, { recursive: true });

const externals = ["react", "react/jsx-runtime", "react-dom", "@deepseek-ai/*"];

const clientOptions = {
  entryPoints: ["src/client.tsx"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2022"],
  external: externals,
  jsx: "automatic",
  write: false,
  sourcemap: false,
  logLevel: "info",
  legalComments: "none",
};

function wrapClient(code) {
  return [
    'window.__ModuleLoader__.load({',
    '\tid: ' + JSON.stringify(pkg.name) + ',',
    '\tfactory: (require) => {',
    '\t\tvar module = { exports: {} };',
    '\t\tvar exports = module.exports;',
    '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    code,
    '\t\treturn module.exports;',
    '\t}',
    '});',
    '',
  ].join('\n');
}

async function buildClient() {
  const result = await esbuild.build(clientOptions);
  const code = result.outputFiles[0].text;
  fs.writeFileSync(path.join(outDir, "client.js"), wrapClient(code), "utf8");
  console.log("built lib/client.js");
}

async function buildHost() {
  await esbuild.build({
    entryPoints: ["src/host.ts"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: ["es2022"],
    outfile: path.join(outDir, "index.js"),
    sourcemap: false,
    logLevel: "info",
    legalComments: "none",
  });
  console.log("built lib/index.js");
}

if (isWatch) {
  const ctx = await esbuild.context(clientOptions);
  await ctx.watch();
  console.log("watching src/client.tsx...");
} else {
  await Promise.all([buildClient(), buildHost()]);
}
