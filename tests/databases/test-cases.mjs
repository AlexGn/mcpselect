/**
 * Database MCP Server Test Cases
 * Task-based definitions for database operations.
 */

export const TASK_DEFINITIONS = [
  {
    name: "list_tables",
    description: "List or discover database tables/collections/keys",
    defaultArgs: {},
  },
  {
    name: "describe_table",
    description: "Get schema or structure of a table/collection",
    defaultArgs: {},
  },
  {
    name: "query",
    description: "Execute a read query or fetch data",
    defaultArgs: {},
  },
  {
    name: "sample",
    description: "Get a sample of data from a table/collection",
    defaultArgs: {},
  },
  {
    name: "schema",
    description: "Get overall database schema or metadata",
    defaultArgs: {},
  },
]

export const SERVERS = [
  {
    name: "SQLite MCP",
    command: "npx",
    args: ["-y", "mcp-sqlite@latest", "/tmp/benchmark.db"],
    env: {},
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/sqlite.mjs",
  },
  {
    name: "PostgreSQL MCP",
    command: "npx",
    args: ["-y", "mcp-postgres@latest"],
    env: {
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_USER: process.env.USER || "postgres",
      DB_NAME: "testdb",
      DB_SSL_MODE: "disable",
    },
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/postgres.mjs",
  },
  {
    name: "Redis MCP",
    command: "npx",
    args: ["-y", "mcp-redis@latest"],
    env: {},
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/redis.mjs",
  },
]
