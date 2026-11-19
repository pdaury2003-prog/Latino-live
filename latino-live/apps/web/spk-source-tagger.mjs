// Development-only webpack loader. It stamps every JSX element with
// data-spk-src="<file>:<line>:<column>" so the ExaSpark Preview can map a
// clicked DOM node back to the source that rendered it. The attribute is
// inserted before the element's own attributes, so a wrapper that spreads
// `{...props}` onto its root element reports the call site, not its internals.
// It never runs for `next build`, and the attribute never exists in source.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Paths are relative to the project root, where builder/project-manifest.json
// is, so a website in apps/<name> reports apps/<name>/app/page.tsx the way the
// Agent sees it. Without that file the website's own folder is the root.
const roots = new Map();
function projectRoot(start) {
  if (!roots.has(start)) {
    let root = start;
    for (let directory = start; ; directory = path.dirname(directory)) {
      if (fs.existsSync(path.join(directory, "builder", "project-manifest.json"))) { root = directory; break; }
      if (path.dirname(directory) === directory) break;
    }
    roots.set(start, root);
  }
  return roots.get(start);
}

export default function spkSourceTagger(source) {
  const file = path
    .relative(projectRoot(this.rootContext || process.cwd()), this.resourcePath)
    .split(path.sep)
    .join("/");
  const sourceFile = ts.createSourceFile(
    this.resourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const insertions = [];
  const visit = (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      // React.Fragment accepts only `key` and `children`; tagging it would warn.
      !/(?:^|\.)Fragment$/u.test(node.tagName.getText(sourceFile))
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      insertions.push({
        // `attributes.pos` follows the tag name and any type arguments.
        at: node.attributes.pos,
        text: ` data-spk-src="${file}:${line + 1}:${character + 1}"`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (insertions.length === 0) return source;
  let output = "";
  let cursor = 0;
  for (const { at, text } of insertions) {
    output += source.slice(cursor, at) + text;
    cursor = at;
  }
  return output + source.slice(cursor);
}
