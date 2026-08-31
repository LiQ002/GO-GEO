const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const adminRoot = path.resolve(__dirname, '..');
const sourcePath = path.resolve(adminRoot, '../kratos-svr/openapi.yaml');
const targetPath = path.resolve(adminRoot, 'config/geo-admin.openapi.json');

const document = yaml.load(fs.readFileSync(sourcePath, 'utf8'));
document.paths = Object.fromEntries(
  Object.entries(document.paths)
    .filter(([route, pathItem]) => {
      if (!route.startsWith('/api/admin/v1/')) return false;
      const operations = Object.values(pathItem);
      return operations.every(
        (operation) =>
          !operation?.tags?.includes('WorkerTaskService'),
      );
    })
    // Transform Google API custom verb paths (e.g. "/path:reset") to
    // URL-encoded form ("%3Areset") so the @umijs/max-plugin-openapi does
    // not misinterpret ":reset" as an Express-style path parameter.
    .map(([route, pathItem]) => [
      route.replace(/:([a-z][a-z-]*)$/i, '%3A$1'),
      pathItem,
    ]),
);
fs.writeFileSync(targetPath, `${JSON.stringify(document, null, 2)}\n`);

console.log(
  `Synced ${path.relative(adminRoot, sourcePath)} -> ${path.relative(adminRoot, targetPath)}`,
);
