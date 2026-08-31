#!/usr/bin/env bash
# All tests. No install step, no dependencies.
set -u
cd "$(dirname "$0")/.."
fail=0

echo "── bundle: dist/all-in-one.gs is in sync with gas/"
node test/build-all-in-one.mjs --check || fail=1
echo

echo "── guide: app/guide.html is in sync with docs/guide.md"
node test/build-guide.mjs --check || fail=1
echo

echo "── corpus: data/grammar-seed.tsv is in sync with gas/GrammarSeed.gs"
node test/build-grammar-tsv.mjs --check || fail=1
echo

echo "── syntax: every .gs and .js file parses"
node -e '
const fs=require("fs");let bad=0;
const files=[...fs.readdirSync("gas").filter(f=>f.endsWith(".gs")).map(f=>"gas/"+f),
             ...fs.readdirSync("app").filter(f=>f.endsWith(".js")).map(f=>"app/"+f)];
for (const f of files){ try{ new Function(fs.readFileSync(f,"utf8")); }
  catch(e){ bad++; console.log("  FAIL "+f+": "+e.message); } }
console.log(bad? bad+" file(s) with syntax errors" : "  "+files.length+" files parse");
process.exit(bad?1:0);' || fail=1
echo

for t in test/fsrs.test.mjs test/session.test.mjs test/auth.test.mjs \
         test/import-format.test.mjs test/bank-load.test.mjs test/session-server.test.mjs \
         test/practice-server.test.mjs \
         test/answer.test.mjs test/grammar-client.test.mjs test/bot-commands.test.mjs \
         test/grammar-server.test.mjs test/grammar-import.test.mjs test/grammar-e2e.test.mjs \
         test/dom-ids.test.mjs test/css-hidden.test.mjs test/theme.test.mjs test/contrast.test.mjs test/css-perf.test.mjs test/decor.test.mjs \
         test/guide-html.test.mjs; do
  echo "── $t"
  node "$t" || fail=1
  echo
done
echo "── календарь: ни один набор не зависит от текущей даты"
node test/timetravel.mjs || fail=1
echo

if [ "$fail" -ne 0 ]; then echo "FAILED"; exit 1; fi
echo "all suites green"
