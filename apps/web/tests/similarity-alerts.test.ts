import { it, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import reference from "../src/lib/examples/us20080003142a1.json";
import { PatentSchema } from "../src/lib/providers/types";
import { localExtract } from "../src/lib/local-extract";
import {
  similarityAlerts,
  withResearchAlerts,
} from "../src/lib/intelligence/alerts";
import { POST as vault, GET as portfolio } from "../src/app/api/vault/route";
import {
  GET as alerts,
  POST as acknowledge,
} from "../src/app/api/project-alerts/route";
const description =
  "A microfluidic substrate uses an inlet channel to carry dispersed phase fluid into a continuous phase fluid. A flow focusing nozzle produces uniform monodisperse droplets. A coalescence apparatus uses electrodes to generate an electric field. A detection module evaluates droplet contents with an optical detector.";
const patent = PatentSchema.parse(reference.patent),
  profile = localExtract(description);
it("flags explained multi-feature overlap with real claim excerpts and preserves legal uncertainty", () => {
  const signal = similarityAlerts(profile, [patent]);
  expect(signal).toHaveLength(1);
  expect(signal[0].publicationNumber).toBe("US20080003142A1");
  expect(signal[0].matches.length).toBeGreaterThanOrEqual(2);
  expect(signal[0].evidenceBasis).toBe("claim excerpts");
  expect(signal[0].sourceUrl).toBe(
    "https://patents.google.com/patent/US20080003142A1/en",
  );
  expect(signal[0].legalStatusNotice).toContain("not independently verified");
  expect(
    similarityAlerts(
      profile,
      [patent],
      [{ ...signal[0], acknowledged: true }],
    )[0].acknowledged,
  ).toBe(true);
});
it("does not alert on unrelated designs, generic vocabulary, title-only data, synthetic patents or unsafe links", () => {
  const unrelated = localExtract(
    "A motor shaft transfers rotational loads to a steel gear. A mechanical housing has bolted mounting holes and a bearing support.",
  );
  expect(similarityAlerts(unrelated, [patent])).toEqual([]);
  const generic = localExtract(
    "A system device comprises modules and apparatus. The method comprises another module with a device apparatus.",
  );
  expect(similarityAlerts(generic, [patent])).toEqual([]);
  expect(
    similarityAlerts(profile, [
      { ...patent, claims: [], abstract: undefined, title: description },
    ]),
  ).toEqual([]);
  expect(similarityAlerts(profile, [{ ...patent, synthetic: true }])).toEqual(
    [],
  );
  expect(
    similarityAlerts(profile, [
      { ...patent, sourceUrl: "javascript:alert(1)" },
    ]),
  ).toEqual([]);
});
it("stores the same alert on repeat evaluation and verifies the exact uploaded source excerpt", async () => {
  const research = {
    profile,
    patents: [patent],
    papers: [],
    warnings: [],
    queries: [],
    mode: "PARTIAL",
  };
  const data = withResearchAlerts({ research });
  expect(data.similarityAlerts).toHaveLength(1);
  const bytes = await readFile("public/examples/US20080003142A1-excerpt.pdf");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    reference.sourceDocument.sha256,
  );
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(4);
  expect(bytes.length).toBeLessThan(4 * 1024 * 1024);
});
const request = (path: string, body?: object, cookie?: string) =>
  new Request("http://localhost:3000" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
it("persists project alerts, protects them by owner and retains review state", async () => {
  const signup = await vault(
    request("/api/vault", {
      action: "register",
      email: `alerts-${randomUUID()}@example.test`,
      password: `test-password-${randomUUID()}`,
    }),
  );
  expect(signup.status).toBe(200);
  const cookie = signup.headers.get("set-cookie")!.split(";")[0];
  const saved = await vault(
    request(
      "/api/vault",
      {
        action: "save",
        kind: "project",
        title: "Microfluidic alert test",
        data: {
          description,
          research: {
            profile,
            patents: [patent],
            papers: [],
            warnings: [],
            queries: [],
            mode: "PARTIAL",
          },
        },
      },
      cookie,
    ),
  );
  const { id } = await saved.json();
  expect((await alerts(request("/api/project-alerts"))).status).toBe(401);
  const before = await (
    await alerts(request("/api/project-alerts", undefined, cookie))
  ).json();
  expect(before.unread).toBe(1);
  const row = before.alerts[0];
  const stranger = await vault(
    request("/api/vault", {
      action: "register",
      email: `other-${randomUUID()}@example.test`,
      password: `test-password-${randomUUID()}`,
    }),
  );
  const other = stranger.headers.get("set-cookie")!.split(";")[0];
  expect(
    (
      await acknowledge(
        request(
          "/api/project-alerts",
          { projectId: id, alertId: row.id, acknowledged: true },
          other,
        ),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await acknowledge(
        request(
          "/api/project-alerts",
          { projectId: id, alertId: row.id, acknowledged: true },
          cookie,
        ),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await (
        await alerts(request("/api/project-alerts", undefined, cookie))
      ).json()
    ).unread,
  ).toBe(0);
  const stored = await (
    await portfolio(request("/api/vault", undefined, cookie))
  ).json();
  expect(stored.items[0].data.similarityAlerts[0].acknowledged).toBe(true);
});
