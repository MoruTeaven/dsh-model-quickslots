import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";
const LOG = "F:\\Code\\OpenSource\\dsh\\dsh-model-quickslots\\.measure.log";
writeFileSync(LOG, "=== measure " + new Date().toISOString() + " ===\n");
createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const u = new URL(req.url, "http://127.0.0.1");
  appendFileSync(LOG, new Date().toISOString().slice(11,23) + "  " + (u.searchParams.get("d") || "") + "\n");
  res.writeHead(200); res.end("ok");
}).listen(19777, "127.0.0.1", () => appendFileSync(LOG, "listening\n"));
