#!/usr/bin/env sh
# Usage: scripts/orca-shot.sh <browserPageId> <output.png> [full]
# Captures an Orca built-in browser tab (explicit page id) into a PNG evidence file.
page="$1"
out="$2"
cmd=screenshot
[ "$3" = "full" ] && cmd=full-screenshot
orca "$cmd" --page "$page" --json | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const j = JSON.parse(s);
  if (!j.ok) { console.error(JSON.stringify(j.error || j)); process.exit(1); }
  require("fs").writeFileSync(process.argv[1], Buffer.from(j.result.data, "base64"));
  console.log("saved", process.argv[1]);
});
' "$out"
