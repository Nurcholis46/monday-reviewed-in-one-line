// W4-REV1 monday: the gate is rebuilt as a validateLine() collector so every
// rule reports itself at once, and the write step is split into its own
// function with a read-back check. Same entry line, same behaviour.
import * as fs from "node:fs";

const OUT_DIR = "/output";
const OUT_FILE = "/output/entry.txt";
const STAGING_FILE = "/output/.entry.txt.tmp";
const MAX_CHARS = 200;

const LINE_PIECES: string[] = [
  "One star: Monday showed up early, broke the coffee machine, ",
  "then scheduled a meeting to discuss why I looked tired.",
];
const entryLine: string = LINE_PIECES.join("");

function hasHiddenChar(line: string): boolean {
  const sep2028 = String.fromCharCode(0x2028);
  const sep2029 = String.fromCharCode(0x2029);
  if (line.includes(sep2028) || line.includes(sep2029)) {
    return true;
  }
  return [...line].some((ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0x1f || cp === 0x7f || cp === 0xfeff) {
      return true;
    }
    return cp >= 0x200b && cp <= 0x200d;
  });
}

function validateLine(line: string): string[] {
  const found: string[] = [];
  const size = [...line].length;
  if (size < 1 || size > MAX_CHARS) {
    found.push(`length ${size} is outside 1-${MAX_CHARS} characters`);
  }
  if (line.trim().length === 0) {
    found.push("line is blank");
  }
  if (line.includes("\n") || line.includes("\r")) {
    found.push("line spans more than one line");
  }
  if (line !== line.trim()) {
    found.push("line starts or ends with whitespace");
  }
  if (hasHiddenChar(line)) {
    found.push("line holds a separator, control or invisible character");
  }
  return found;
}

function writeLine(line: string): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // W4-REV2: a crashed earlier run can leave a stale staging file behind;
  // clear it first so a leftover partial write can never be renamed in.
  if (fs.existsSync(STAGING_FILE)) {
    fs.unlinkSync(STAGING_FILE);
  }
  fs.writeFileSync(STAGING_FILE, line, { encoding: "utf8", mode: 0o644 });
  fs.chmodSync(STAGING_FILE, 0o644);
  fs.renameSync(STAGING_FILE, OUT_FILE);
}

function checkFile(line: string): void {
  const onDisk = fs.readFileSync(OUT_FILE, "utf8");
  if (onDisk !== line) {
    throw new Error("entry file on disk differs from the gated line");
  }
  if (onDisk.endsWith("\n") || onDisk.endsWith("\r")) {
    throw new Error("entry file ends with a line break");
  }
  const diskBytes = Buffer.byteLength(onDisk, "utf8");
  const lineBytes = Buffer.byteLength(line, "utf8");
  if (diskBytes !== lineBytes) {
    throw new Error("entry file byte length differs from the gated line");
  }
}

const faults = validateLine(entryLine);
if (faults.length > 0) {
  throw new Error(`entry rejected: ${faults.join("; ")}`);
}
writeLine(entryLine);
checkFile(entryLine);
