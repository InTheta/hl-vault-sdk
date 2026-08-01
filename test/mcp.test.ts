import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("keyless MCP exposes bounded vault tools and uses only the delegated token", async (context) => {
  const requests: Array<{ url: string; authorization: string | undefined }> = [];
  const http = createServer((request, response) => {
    requests.push({ url: request.url ?? "", authorization: request.headers.authorization });
    response.setHeader("content-type", "application/json");
    if (request.url === "/v1/capabilities") {
      response.end(JSON.stringify({ vault: "0xvault", allowed_markets: ["SOL"] }));
      return;
    }
    if (request.url === "/v1/account" && request.headers.authorization === "Bearer delegated-token") {
      response.end(JSON.stringify({ vault: "0xvault", openOrders: [] }));
      return;
    }
    response.statusCode = 401;
    response.end(JSON.stringify({ error: "unauthorized" }));
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  context.after(() => http.close());
  const address = http.address();
  assert(address && typeof address === "object");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/mcp-server.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      HL_VAULT_EXECUTOR_URL: `http://127.0.0.1:${address.port}`,
      HL_VAULT_AGENT_TOKEN: "delegated-token",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "hl-vault-mcp-test", version: "0.1.0" });
  context.after(async () => client.close());
  await client.connect(transport);
  const catalog = await client.listTools();
  const names = catalog.tools.map((tool) => tool.name);
  assert(names.includes("get_vault_account"));
  assert(names.includes("place_vault_order"));
  assert(names.includes("close_vault_position"));
  assert(names.includes("cancel_vault_order"));
  assert(!names.some((name) => name.includes("withdraw") || name.includes("transfer")));

  const result = await client.callTool({ name: "get_vault_account", arguments: {} });
  assert.equal(result.isError, undefined);
  assert.deepEqual(requests, [
    { url: "/v1/account", authorization: "Bearer delegated-token" },
  ]);
});
