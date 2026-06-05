import { prisma } from "../db";
import { DEFAULT_RULE_CONFIG, RuleConfig } from "../config/rules";

const RULE_CONFIG_KEY = "RULES_CONFIG";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

export async function getRuleConfig(): Promise<RuleConfig> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: RULE_CONFIG_KEY } });
  if (!setting) {
    return DEFAULT_RULE_CONFIG;
  }

  if (!setting.value || typeof setting.value !== "object") {
    return DEFAULT_RULE_CONFIG;
  }

  return deepMerge(DEFAULT_RULE_CONFIG as Record<string, unknown>, setting.value as Record<string, unknown>) as RuleConfig;
}

export async function upsertRuleConfig(config: RuleConfig) {
  return prisma.systemSetting.upsert({
    where: { key: RULE_CONFIG_KEY },
    create: {
      key: RULE_CONFIG_KEY,
      value: config as unknown as object,
      type: "json",
      description: "Dynamic rule engine configuration for violations and booking rules",
      isPublic: false,
    },
    update: {
      value: config as unknown as object,
      type: "json",
    },
  });
}
