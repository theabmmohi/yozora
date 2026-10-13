import { existsSync, readFileSync } from "node:fs"
import { renderToString } from "react-dom/server"
import { createRequire } from "node:module"
import { createElement } from "react"
import assert from "node:assert/strict"

const require = createRequire(import.meta.url)
const esm = await import("../dist/index.js")
const cjs = require("../dist/index.cjs")
const tabs = [
  { id: "a", label: "A", icon: createElement("svg"), activeIcon: createElement("svg") },
  { id: "b", label: "B", icon: createElement("svg") }
]

for (const [name, mod] of [
  ["esm", esm],
  ["cjs", cjs]
]) {
  assert.equal(typeof mod.Yozora, "object", `${name}: Yozora export`)
  const html = renderToString(createElement(mod.Yozora, { tabs, defaultValue: "b" }))
  assert.ok(html.includes('role="navigation"'), `${name}: renders a navigation landmark`)
  assert.ok(html.includes('aria-current="page"'), `${name}: marks the active tab`)
}

assert.ok(existsSync(new URL("../dist/styles.css", import.meta.url)), "dist/styles.css exists")
assert.ok(readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8").includes("--yozora-bg"), "styles.css has the stylesheet")
assert.ok(!readFileSync(new URL("../dist/index.js", import.meta.url), "utf8").includes("--yozora-bg"), "CSS is not inlined into the JS bundle")
for (const f of ["index.d.ts", "index.d.cts"]) assert.ok(existsSync(new URL(`../dist/${f}`, import.meta.url)), `dist/${f} exists`)

console.log("dist smoke test passed")
