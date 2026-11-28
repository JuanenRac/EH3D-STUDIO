// @vitest-environment node
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { Eh3dError, LIMITS, openProject, pictureType, readAttachment, safeName, viewOf } from "./eh3d";

/** A ZIP with these entries, each stored or deflated. `claim` makes an entry say another unpacked size. */
function zip(files: { name: string; data: Uint8Array; stored?: boolean; claim?: number }[]): Blob {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const packed = f.stored ? Buffer.from(f.data) : deflateRawSync(f.data);
    const size = f.claim ?? f.data.length;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(f.stored ? 0 : 8, 8);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(size, 22);
    head.writeUInt16LE(name.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(f.stored ? 0 : 8, 10);
    dir.writeUInt32LE(packed.length, 20);
    dir.writeUInt32LE(size, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    local.push(head, name, packed);
    central.push(dir, name);
    offset += 30 + name.length + packed.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Blob([new Uint8Array(Buffer.concat([...local, cd, end]))]);
}

const bytes = (s: string) => new TextEncoder().encode(s);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function project(index: unknown, extra: { name: string; data: Uint8Array; claim?: number }[] = []) {
  return zip([{ name: "project.json", data: bytes("{}"), stored: true }, { name: "attachments/index.json", data: bytes(JSON.stringify(index)) }, ...extra]);
}

describe("the attachments of an .eh3d project", () => {
  const note = bytes("a note about U3\n".repeat(40));
  const id = sha(note);
  const record = { sha256: id, name: "note.txt", size: note.length, kind: "text", components: [{ reference: "U3" }] };

  it("lists them and reads one in parts, checked against its hash", async () => {
    const half = note.length / 2;
    const p = await openProject(
      project({ schema: 1, attachments: [record] }, [
        { name: `attachments/blobs/${id}/00000`, data: note.subarray(0, half) },
        { name: `attachments/blobs/${id}/00001`, data: note.subarray(half) },
      ]),
    );
    expect(p.attachments).toEqual([{ sha256: id, name: "note.txt", size: note.length, kind: "text", url: null, components: ["U3"], asks: false }]);
    const content = await readAttachment(p, p.attachments[0], LIMITS.text);
    expect(content.verified).toBe(true);
    expect(new TextDecoder().decode(content.bytes)).toBe(new TextDecoder().decode(note));
  });

  it("refuses bytes that are not the ones of the hash, a size that lies and one over the limit", async () => {
    const other = bytes("x".repeat(note.length));
    const swapped = await openProject(project({ schema: 1, attachments: [record] }, [{ name: `attachments/blobs/${id}/00000`, data: other }]));
    await expect(readAttachment(swapped, swapped.attachments[0], LIMITS.text)).rejects.toEqual(new Eh3dError("damaged"));
    const bomb = await openProject(project({ schema: 1, attachments: [{ ...record, size: 10 }] }, [{ name: `attachments/blobs/${id}/00000`, data: note, claim: 10 }]));
    await expect(readAttachment(bomb, bomb.attachments[0], LIMITS.text)).rejects.toEqual(new Eh3dError("damaged"));
    await expect(readAttachment(swapped, swapped.attachments[0], 5)).rejects.toEqual(new Eh3dError("too_large"));
  });

  it("refuses what is not a project and a newer index", async () => {
    await expect(openProject(new Blob(["not a zip at all"]))).rejects.toEqual(new Eh3dError("not_zip"));
    await expect(openProject(zip([{ name: "a.txt", data: note }]))).rejects.toEqual(new Eh3dError("not_zip"));
    await expect(openProject(project({ schema: 2, attachments: [] }))).rejects.toEqual(new Eh3dError("unsupported"));
    expect((await openProject(zip([{ name: "project.json", data: bytes("{}") }]))).attachments).toEqual([]);
  });

  it("asks before saving what can run, and never shows a page or an SVG", async () => {
    const p = await openProject(
      project({
        schema: 1,
        attachments: [
          { ...record, name: "page.html", kind: "other" },
          { ...record, name: "draw.svg", kind: "image" },
          { ...record, name: "tool.exe", kind: "text" },
          { ...record, name: "manual.pdf", kind: "pdf" },
          { sha256: id, name: "far.pdf", kind: "pdf", storage: "link", url: "https://example.invalid/far.pdf" },
          { sha256: "not a hash", name: "x" },
        ],
      }),
    );
    expect(p.attachments.map((a) => [a.name, a.asks, viewOf(a)])).toEqual([
      ["page.html", true, "none"],
      ["draw.svg", true, "none"],
      ["tool.exe", true, "text"],
      ["manual.pdf", false, "none"],
      ["far.pdf", false, "none"],
    ]);
  });

  it("makes names safe and tells pictures by their first bytes", () => {
    expect(safeName("../..\\etc/passwd")).toBe("_.._etc_passwd");
    expect(safeName("-rf")).toBe("rf");
    expect(safeName("CON.txt")).toBe("attachment");
    expect(safeName("a\u202egpj.exe")).toBe("a_gpj.exe");
    expect(safeName("...")).toBe("attachment");
    expect(pictureType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(pictureType(bytes("<svg onload=alert(1)>"))).toBeNull();
  });
});
