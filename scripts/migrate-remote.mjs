import { execFileSync } from "node:child_process";

const databaseName = "spotistats-personal-20261103-db";

const output = execFileSync("cf", ["d1", "list", "--name", databaseName], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

const parsed = JSON.parse(output);
const records = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed.result)
    ? parsed.result
    : Array.isArray(parsed.databases)
      ? parsed.databases
      : [];
const matches = records.filter((record) => record.name === databaseName);

if (matches.length !== 1) {
  throw new Error(
    `Expected one D1 database named ${databaseName}; found ${matches.length}.`,
  );
}

const databaseId = matches[0].uuid ?? matches[0].id;
if (typeof databaseId !== "string" || databaseId.length === 0) {
  throw new Error("Cloudflare did not return the D1 database ID.");
}

execFileSync("cf", ["d1", "migrations", "apply", databaseId], {
  stdio: "inherit",
});
