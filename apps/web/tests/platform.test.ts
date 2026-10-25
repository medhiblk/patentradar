import { it, expect } from "vitest";
import { POST, GET } from "../src/app/api/vault/route";
import { POST as mcp } from "../src/app/api/mcp/route";
const request = (body: object, cookie?: string) =>
  new Request("http://localhost:3000/api/vault", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
it("private items, scoped MCP tokens and sessions are isolated by user", async () => {
  const a = await POST(
    request({
      action: "register",
      email: "a" + Date.now() + "@example.test",
      password: "long-test-password-A",
    }),
  );
  expect(a.status).toBe(200);
  const cookie = a.headers.get("set-cookie")!.split(";")[0];
  const save = await POST(
    request(
      {
        action: "save",
        kind: "project",
        title: "Private invention",
        data: { description: "private" },
      },
      cookie,
    ),
  );
  expect(save.status).toBe(200);
  const b = await POST(
    request({
      action: "register",
      email: "b" + Date.now() + "@example.test",
      password: "long-test-password-B",
    }),
  );
  const second = b.headers.get("set-cookie")!.split(";")[0];
  const list = await GET(
    new Request("http://localhost:3000/api/vault", {
      headers: { cookie: second },
    }),
  );
  expect((await list.json()).items).toHaveLength(0);
  const item = await save.json();
  const overwrite = await POST(
    request(
      {
        action: "save",
        id: item.id,
        kind: "project",
        title: "stolen",
        data: {},
      },
      second,
    ),
  );
  expect(overwrite.status).toBe(404);
  const token = await (await POST(request({ action: "token" }, cookie))).json();
  const query = await mcp(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token.token,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_my_projects", arguments: {} },
      }),
    }),
  );
  expect(query.status).toBe(200);
  expect(JSON.stringify(await query.json())).toContain("Private invention");
  const forbidden = await POST(
    new Request("http://localhost:3000/api/vault", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token.token,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "save",
        kind: "project",
        title: "MCP cannot write",
        data: {},
      }),
    }),
  );
  expect(forbidden.status).not.toBe(200);
});
