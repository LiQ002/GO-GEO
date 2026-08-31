import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const openapiPath = resolve(projectRoot, "../kratos-svr/openapi.yaml");
const outputPath = resolve(projectRoot, "src/lib/api/user-api.generated.ts");

const document = parse(readFileSync(openapiPath, "utf8"));
const schemas = document.components?.schemas ?? {};
const groups = new Map();
const operations = [];

for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
  if (!path.startsWith("/api/user/v1/")) continue;
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem[method];
    if (!operation) continue;
    const [serviceName, operationName] = operation.operationId.split("_");
    if (!serviceName || !operationName) {
      throw new Error(`Invalid operationId: ${operation.operationId}`);
    }
    const groupName = lowerFirst(serviceName.replace(/Service$/, ""));
    const entry = { groupName, method, operation, operationName, path };
    operations.push(entry);
    const group = groups.get(groupName) ?? [];
    group.push(entry);
    groups.set(groupName, group);
  }
}

if (operations.length === 0) {
  throw new Error("No /api/user/v1 operations found in openapi.yaml");
}

const lines = [
  "/* eslint-disable */",
  "// 本文件由 scripts/generate-user-api.mjs 根据 kratos-svr/openapi.yaml 自动生成，请勿手动修改。",
  '"use client";',
  "",
  'import { apiRequest } from "./client";',
  "",
  "type PathValue = number | string;",
  "",
];

for (const [schemaName, schema] of Object.entries(schemas)) {
  if (
    !schemaName.startsWith("user.v1.") &&
    !schemaName.startsWith("common.v1.")
  )
    continue;
  if (schema.description) lines.push(docComment(schema.description));
  lines.push(
    `export type ${componentTypeName(schemaName)} = ${objectType(schema)};`,
  );
  lines.push("");
}

for (const entry of operations) {
  const queryParameters = parameters(entry.operation, "query");
  if (queryParameters.length === 0) continue;
  lines.push(`export type ${queryTypeName(entry)} = {`);
  for (const parameter of queryParameters) {
    if (parameter.description)
      lines.push(`  ${docComment(parameter.description)}`);
    lines.push(
      `  ${propertyName(parameter.name)}?: ${schemaType(parameter.schema)};`,
    );
  }
  lines.push("};", "");
}

lines.push("export const userApi = {");
for (const [groupName, entries] of [...groups].sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  lines.push(`  ${groupName}: {`);
  for (const entry of entries.sort((left, right) =>
    left.operationName.localeCompare(right.operationName),
  )) {
    lines.push(...operationMethod(entry));
  }
  lines.push("  },");
}
lines.push("} as const;", "");
lines.push(
  `export const USER_API_OPERATION_COUNT = ${operations.length} as const;`,
  "",
  "export const userApiOperationIds = [",
);
for (const entry of operations.sort((left, right) =>
  left.operation.operationId.localeCompare(right.operation.operationId),
)) {
  lines.push(`  ${JSON.stringify(entry.operation.operationId)},`);
}
lines.push("] as const;", "");
lines.push(
  "function encodePath(value: PathValue) {",
  "  return encodeURIComponent(String(value));",
  "}",
  "",
);

writeFileSync(outputPath, `${lines.join("\n")}\n`);
execFileSync(
  resolve(projectRoot, "node_modules/.bin/biome"),
  ["format", "--write", outputPath],
  { shell: process.platform === "win32" },
);
console.log(
  `Generated ${operations.length} user API operations from ${openapiPath}`,
);

function operationMethod(entry) {
  const pathParameters = parameters(entry.operation, "path");
  const queryParameters = parameters(entry.operation, "query");
  const requestSchema =
    entry.operation.requestBody?.content?.["application/json"]?.schema;
  const responseSchema =
    entry.operation.responses?.["200"]?.content?.["application/json"]?.schema;
  const args = pathParameters.map(
    (parameter) =>
      `${parameterVariable(parameter.name)}: ${schemaType(parameter.schema)}`,
  );
  if (requestSchema) args.push(`body: ${schemaType(requestSchema)}`);
  if (queryParameters.length > 0) {
    args.push(`query: ${queryTypeName(entry)} = {}`);
  }

  const relativePath = entry.path
    .replace("/api/user/v1", "")
    .replaceAll(
      /\{([^}]+)\}/g,
      (_, name) => `\${encodePath(${parameterVariable(name)})}`,
    );
  const pathExpression = relativePath.includes("${")
    ? `\`${relativePath}\``
    : JSON.stringify(relativePath);
  const options = [];
  if (entry.method !== "get")
    options.push(`method: ${JSON.stringify(entry.method.toUpperCase())}`);
  if (requestSchema) options.push("body");
  if (queryParameters.length > 0) options.push("query");
  const request =
    options.length > 0
      ? `apiRequest<${schemaType(responseSchema)}>(${pathExpression}, { ${options.join(", ")} })`
      : `apiRequest<${schemaType(responseSchema)}>(${pathExpression})`;

  return [
    `    ${docComment(entry.operation.summary || entry.operationName)}`,
    `    ${lowerFirst(entry.operationName)}(${args.join(", ")}) {`,
    `      return ${request};`,
    "    },",
  ];
}

function parameters(operation, location) {
  return (operation.parameters ?? []).filter(
    (parameter) => parameter.in === location,
  );
}

function objectType(schema) {
  if (schema.$ref || schema.allOf || schema.type !== "object") {
    return schemaType(schema);
  }
  const properties = Object.entries(schema.properties ?? {});
  if (properties.length === 0) {
    return schema.additionalProperties
      ? `Record<string, ${schemaType(schema.additionalProperties)}>`
      : "Record<string, never>";
  }
  const required = new Set(schema.required ?? []);
  const body = properties.map(([name, property]) => {
    const description = property.description
      ? `\n  ${docComment(property.description)}\n `
      : "";
    return `${description} ${propertyName(name)}${required.has(name) ? "" : "?"}: ${schemaType(property)};`;
  });
  return `{${body.join("")}\n}`;
}

function schemaType(schema) {
  if (!schema) return "void";
  if (schema.$ref) return componentTypeName(schema.$ref.split("/").at(-1));
  if (schema.allOf) {
    return (
      schema.allOf
        .map(schemaType)
        .filter((type) => type !== "unknown")
        .join(" & ") || "unknown"
    );
  }
  if (schema.oneOf) return schema.oneOf.map(schemaType).join(" | ");
  if (schema.enum)
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.type === "array") return `Array<${schemaType(schema.items)}>`;
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "string") return "string";
  if (schema.type === "object") return objectType(schema);
  return "unknown";
}

function componentTypeName(name) {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function queryTypeName(entry) {
  return `UserApi${upperFirst(entry.groupName)}${entry.operationName}Query`;
}

function parameterVariable(name) {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return lowerFirst(parts.map(upperFirst).join(""));
}

function propertyName(name) {
  return /^[a-zA-Z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function docComment(value) {
  return `/** ${String(value).replaceAll("*/", "* /")} */`;
}

function lowerFirst(value) {
  return value[0].toLowerCase() + value.slice(1);
}

function upperFirst(value) {
  return value[0].toUpperCase() + value.slice(1);
}
