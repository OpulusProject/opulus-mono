import pino from "pino";
import config from "../config/default.js";

const logLevel =
  process.env.LOG_LEVEL || (config.nodeEnv === "production" ? "info" : "debug");

/**
 * Fields that must never reach the logs, whatever a log call puts in them:
 * credentials and tokens, session cookies, and the user's email (a user id is
 * enough to follow someone through the logs). Matched by name at the top level
 * of a log call's object and one level down (`{ user: { email } }`), which is
 * how pino's redaction paths work.
 */
const SENSITIVE_FIELDS = [
  "password",
  "newPassword",
  "currentPassword",
  "secret",
  "client_secret",
  "token",
  "accessToken",
  "access_token",
  "publicToken",
  "public_token",
  "linkToken",
  "link_token",
  "userToken",
  "user_token",
  "backupCodes",
  "totpURI",
  "authorization",
  "cookie",
  "set-cookie",
  "email",
];

export const logger = pino({
  level: logLevel,
  redact: {
    paths: [
      ...SENSITIVE_FIELDS,
      ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
      // Request headers, as pino's HTTP serializers and Express put them.
      "headers.authorization",
      "headers.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
    ],
    censor: "[Redacted]",
  },
  transport:
    config.nodeEnv === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    env: config.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
