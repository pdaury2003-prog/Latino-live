const fs = require("node:fs");
const path = require("node:path");

// DESIGN.md belongs to the project, not to one app: a website in apps/<name>
// reads the one at the project root, where builder/project-manifest.json is.
function projectRoot(start) {
  for (let directory = start; ; directory = path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, "builder", "project-manifest.json"))) return directory;
    if (path.dirname(directory) === directory) return start;
  }
}

/** Webpack uses this same compiler in development watch mode and production. */
module.exports = function spkDesignLoader() {
  const done = this.async();
  const project = path.resolve(path.dirname(this.resourcePath), "..");
  const documentPath = path.join(projectRoot(project), "DESIGN.md");
  if (fs.existsSync(documentPath)) this.addDependency(documentPath);
  else this.addMissingDependency(documentPath);
  import("./spk-design-compiler.mjs").then(({ parseDesignDocument, defaultDesignDocument, compileDesignCss }) => {
    const design = fs.existsSync(documentPath) ? parseDesignDocument(fs.readFileSync(documentPath, "utf8")) : defaultDesignDocument();
    for (const font of design.fonts) {
      const fontPath = path.join(project, "public", font.src);
      this.addDependency(fontPath);
      if (!fs.existsSync(fontPath)) throw new Error(`DESIGN.md: font asset is missing: public${font.src}`);
    }
    done(null, this.resourcePath.endsWith(".mjs")
      ? `export default ${JSON.stringify({ defaultTheme: design.defaultTheme, themes: Object.keys(design.themes) })};\n`
      : compileDesignCss(design));
  }).catch((error) => done(error));
};
