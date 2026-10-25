import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { POST, GET } from "../src/app/api/vault/route";

const request = (body: object) =>
  new Request("https://localhost/api/vault", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

it("returns actionable validation and credential errors without exposing passwords", async () => {
  const short = await POST(
    request({
      action: "register",
      email: "person@example.test",
      password: "short",
    }),
  );
  expect(short.status).toBe(400);
  expect((await short.json()).error).toContain("12 characters");
  const invalidEmail = await POST(
    request({ action: "login", email: "invalid", password: "password" }),
  );
  expect((await invalidEmail.json()).error).toBe(
    "Enter a valid email address.",
  );
  const missing = await POST(
    request({
      action: "login",
      email: `missing-${randomUUID()}@example.test`,
      password: "short",
    }),
  );
  expect(missing.status).toBe(401);
  const body = await missing.json();
  expect(body.error).toContain("Create workspace account");
  expect(JSON.stringify(body)).not.toContain("short");
});

it("normalizes email on registration and login, keeps sessions, and explains duplicate signup", async () => {
  const email = `login-${randomUUID()}@example.test`,
    password = `test-${randomUUID()}`;
  const created = await POST(
    request({
      action: "register",
      email: ` ${email.toUpperCase()} `,
      password,
    }),
  );
  expect(created.status).toBe(200);
  expect(created.headers.get("set-cookie")).toContain("Secure");
  const duplicate = await POST(
    request({ action: "register", email, password }),
  );
  expect(duplicate.status).toBe(409);
  expect((await duplicate.json()).error).toContain("Sign in to workspace");
  const signedIn = await POST(
    request({ action: "login", email: ` ${email.toUpperCase()} `, password }),
  );
  expect(signedIn.status).toBe(200);
  const session = await GET(
    new Request("https://localhost/api/vault", {
      headers: { cookie: signedIn.headers.get("set-cookie")!.split(";")[0] },
    }),
  );
  expect((await session.json()).user.email).toBe(email);
});
