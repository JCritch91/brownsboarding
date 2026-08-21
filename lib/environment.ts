export type AppEnvironment = "test" | "production";

export function getAppEnvironment(): AppEnvironment {
  return process.env.APP_ENV === "production" ? "production" : "test";
}

export function isTestEnvironment() {
  return getAppEnvironment() === "test";
}

export function getEnvironmentSubjectPrefix() {
  return isTestEnvironment() ? "[TEST] " : "";
}
