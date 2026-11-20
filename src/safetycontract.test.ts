/* The safety of the machines of the plugins against the simulated server of Studio (src/simserver.ts) and, when the repository of the server is next to this one, against its
 * contract (docs/openapi.json, docs/AUTH.md, docs/error-codes.json): the routes that the client calls must exist with their verb, the switches that the page explains must be
 * the ones the server lets change, and the refusals the page meets must have a text. Nothing here has talked to a real machine. GPL-3.0-or-later. */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { errorText } from "./i18n";
import { AuthClient } from "./services/authsvc";
import { ServiceHttp } from "./services/http";
import { SWITCH_NOTES, interlocks, isSimulatorOnly, releaseRoute, safetyActions, stopRoute } from "./services/safety";
import { WorkClient } from "./services/work";
import { SIM_PASSWORD, SIM_POLICY_KEYS, SimServer } from "./simserver";
import { ROWS } from "./texts";

async function signedIn() {
  const server = new SimServer(7);
  const api = new Api(null, server.fetcher);
  await api.login("ana", SIM_PASSWORD);
  const http = new ServiceHttp(() => api.token, server.fetcher, { retries: 0 }, async () => undefined);
  return { server, api, work: new WorkClient(http), auth: new AuthClient(http) };
}

const admin = { role: "admin" } as const;
const operator = { role: "operator" } as const;

describe("the machines of the plugins in the simulated server", () => {
  it("are listed with the evidence of a simulator, and none is shown as proven on hardware", async () => {
    const { work } = await signedIn();
    const machines = await work.machines();
    expect(machines.map((m) => m.id)).toEqual(["laser-1", "cnc-1", "print-1"]);
    for (const m of machines) expect(isSimulatorOnly(m.detail, m.capabilities), m.id).toBe(true);
  });

  it("latch a CNC machine at the emergency stop, and the administrator releases it", async () => {
    const { server, work } = await signedIn();
    const cnc = async () => (await work.machines()).find((m) => m.id === "cnc-1")!;
    expect(safetyActions(operator, "cnc", (await cnc()).detail, null)).toEqual(["emergency_stop"]);
    await work.emergencyStop("cnc-1", "cnc", null);
    const held = await cnc();
    expect(interlocks(held.detail)).toEqual(["latched"]);
    expect(safetyActions(operator, "cnc", held.detail, null)).toEqual([]);
    expect(safetyActions(admin, "cnc", held.detail, null)).toEqual(["release"]);
    await work.release("cnc-1", "cnc");
    expect(interlocks((await cnc()).detail)).toEqual([]);
    expect(server.requests.filter((r) => r.method === "POST" && r.path.startsWith("/work/")).map((r) => r.path)).toEqual(["/work/machines/cnc-1/emergency-stop", "/work/machines/cnc-1/release"]);
  });

  it("already hold a 3D printer that was latched, and release a laser by the route of the laser", async () => {
    const { server, work } = await signedIn();
    const list = await work.machines();
    expect(interlocks(list.find((m) => m.id === "print-1")!.detail)).toEqual(["latched"]);
    server.workMachines[0].detail = { ...server.workMachines[0].detail, estop_latched: true };
    expect(interlocks((await work.machines())[0].detail)).toEqual(["estop_latched"]);
    await work.release("laser-1", "laser");
    expect(interlocks((await work.machines())[0].detail)).toEqual([]);
    expect(server.requests.some((r) => r.path === "/work/machines/laser-1/laser/release")).toBe(true);
  });

  it("refuse a route the plugin does not have, and the client does not ask for it", async () => {
    const { server, work } = await signedIn();
    expect(stopRoute("laser")).toBeNull();
    expect(releaseRoute("pnp")).toBeNull();
    expect(await work.release("laser-1", "pnp")).toBeNull();
    expect(server.requests.some((r) => r.path.includes("/release"))).toBe(false);
    const http = new ServiceHttp(() => "sim-token-1", server.fetcher, { retries: 0 }, async () => undefined);
    await expect(http.json("POST", "/work/machines/laser-1/emergency-stop")).rejects.toMatchObject({ status: 404, code: "not_found" });
  });
});

describe("a stop that does not arrive", () => {
  it("is sent once more when the server did not answer, and only once", async () => {
    const { server, work } = await signedIn();
    server.mode = "flaky";
    server.flakyPerMille = 1000;
    const before = server.attempts;
    await expect(work.emergencyStop("cnc-1", "cnc", null)).rejects.toMatchObject({ status: 0, code: "unreachable" });
    expect(server.attempts - before).toBe(2);
    server.mode = "up";
    await work.emergencyStop("cnc-1", "cnc", null);
    expect(interlocks((await work.machines()).find((m) => m.id === "cnc-1")!.detail)).toEqual(["latched"]);
  });

  it("is not sent again when the server refused it", async () => {
    const { server, work } = await signedIn();
    server.expireSessions();
    const before = server.attempts;
    await expect(work.emergencyStop("cnc-1", "cnc", null)).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    expect(server.attempts - before).toBe(1);
  });
});

describe("the switches of security in the simulated server", () => {
  it("are the four the page explains, all off, and the page has a text for each", async () => {
    const { auth } = await signedIn();
    const policy = await auth.policy();
    expect([...SIM_POLICY_KEYS].sort()).toEqual(Object.keys(SWITCH_NOTES).sort());
    expect(policy.editable?.sort()).toEqual([...SIM_POLICY_KEYS].sort());
    for (const sw of policy.switches) {
      expect(sw.value, sw.key).toBe(false);
      expect(sw.safe, sw.key).toBe(true);
    }
    expect(policy.attention).toEqual([]);
  });

  it("need confirm_weak to be turned on, and none to be turned off", async () => {
    const { auth } = await signedIn();
    const thrown = await auth.changePolicy("compat_write", true).then(
      () => null,
      (e: unknown) => e,
    );
    expect(thrown).toMatchObject({ status: 409, code: "weak_confirm_required" });
    expect(errorText("en", thrown)).toContain("less strict");
    expect((await auth.policy()).switches.find((s) => s.key === "compat_write")?.value).toBe(false);
    const on = await auth.changePolicy("compat_write", true, true);
    expect(on.switches.find((s) => s.key === "compat_write")?.value).toBe(true);
    expect(on.attention).toEqual(["compat_write"]);
    const off = await auth.changePolicy("compat_write", false);
    expect(off.attention).toEqual([]);
  });

  it("refuse a key that the server does not let change", async () => {
    const { auth } = await signedIn();
    await expect(auth.changePolicy("url_token", true, true)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("the contract of the server", () => {
  const dir = (file: string) => new URL(`../../EH3D-SERVER/docs/${file}`, import.meta.url);

  it("has the routes and the verbs that the client calls (when the repository of the server is next to this one)", () => {
    if (!existsSync(dir("openapi.json"))) return; // a checkout of this repository alone has no sibling: nothing to compare with
    const paths = (JSON.parse(readFileSync(dir("openapi.json"), "utf8")) as { paths: Record<string, Record<string, unknown>> }).paths;
    const wanted: [string, string][] = [
      ["/work/machines", "get"],
      ["/work/machines/{id}/emergency-stop", "post"],
      ["/work/machines/{id}/release", "post"],
      ["/work/machines/{id}/laser/release", "post"],
      ["/work/jobs/{id}/cancel", "post"],
      ["/work/jobs/{id}/start", "post"],
      ["/auth/policy", "get"],
      ["/auth/policy", "put"],
    ];
    for (const [path, verb] of wanted) expect(paths[path], `${verb} ${path}`).toHaveProperty(verb);
  });

  it("lets change the switches that the page explains, and names the confirmation of a looser value", () => {
    if (!existsSync(dir("AUTH.md"))) return;
    const auth = readFileSync(dir("AUTH.md"), "utf8");
    for (const key of Object.keys(SWITCH_NOTES)) expect(auth, key).toContain(key);
    expect(auth).toContain("confirm_weak");
  });

  it("has a text in Studio for the refusals of a latched machine, of the switches that are off and of the temperature limits", () => {
    if (!existsSync(dir("error-codes.json"))) return;
    const codes = (JSON.parse(readFileSync(dir("error-codes.json"), "utf8")) as { code: string }[]).map((c) => c.code);
    for (const code of ["weak_confirm_required", "compat_off", "compat_write_off", "slice_off", "laser_estop_latched", "printer_latched", "machine_alarm", "temperature_over_limit", "program_over_limit", "thermal_runaway"]) {
      expect(codes, code).toContain(code);
      expect(ROWS, code).toHaveProperty(`err_${code}`);
    }
  });
});
