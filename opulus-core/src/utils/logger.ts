import pino from "pino";
import config from "../config/default.js";

const logLevel =
  process.env.LOG_LEVEL || (config.nodeEnv === "production" ? "info" : "debug");

export const logger = pino({
  level: logLevel,
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
