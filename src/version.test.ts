// The number of the version is kept in several files; the page that is built carries the one of package.json (version.json, which the server reads to tell which version it
// serves, is made from it), so a release whose package.json was left behind would be installed and still be shown as the old one.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string): { version: string; packages?: Record<string, { version?: string }> } =>
  JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")) as { version: string; packages?: Record<string, { version?: string }> };

describe("the version of the project", () => {
  it("is the same in the manifest, package.json and package-lock.json", () => {
    const manifest = read("eh3d.project.json").version;
    expect(read("package.json").version).toBe(manifest);
    const lock = read("package-lock.json");
    expect(lock.version).toBe(manifest);
    expect(lock.packages?.[""]?.version).toBe(manifest);
  });
});
