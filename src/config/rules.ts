export const Currency = {
  EGP: "EGP",
  USD: "USD",
  EUR: "EUR",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

export const PenaltyType = {
  WARNING: "WARNING",
  BAN: "BAN",
  COMPENSATION: "COMPENSATION",
  SUSPENSION: "SUSPENSION",
  DISCIPLINARY_REFERRAL: "DISCIPLINARY_REFERRAL",
} as const;

export type PenaltyType = (typeof PenaltyType)[keyof typeof PenaltyType];

export const ViolationSeverity = {
  MINOR: "MINOR",
  MAJOR: "MAJOR",
  CRITICAL: "CRITICAL",
} as const;

export type ViolationSeverity = (typeof ViolationSeverity)[keyof typeof ViolationSeverity];

export const ViolationType = {
  LATE_ARRIVAL: "LATE_ARRIVAL",
  EQUIPMENT_DAMAGE: "EQUIPMENT_DAMAGE",
  BEHAVIORAL: "BEHAVIORAL",
  PHYSICAL_ASSAULT: "PHYSICAL_ASSAULT",
  FOOD_DRINK: "FOOD_DRINK",
  UNSUITABLE_SHOES: "UNSUITABLE_SHOES",
  NO_BOOKING: "NO_BOOKING",
  SMOKING: "SMOKING",
  FACILITY_RULE_BREACH: "FACILITY_RULE_BREACH",
} as const;

export type ViolationType = (typeof ViolationType)[keyof typeof ViolationType];

export type SportParticipantRule = {
  min?: number;
  max?: number;
  exact?: number;
  allowedTotals?: number[];
};

export type PenaltyStep = {
  type: PenaltyType;
  durationDays?: number;
  amount?: number;
  currency?: Currency;
  note?: string;
};

export type ViolationPolicy = {
  severity: ViolationSeverity;
  escalation: PenaltyStep[];
};

export type RuleConfig = {
  version: number;
  repeatWindowDays: number;
  booking: {
    sportParticipantRules: Record<string, SportParticipantRule>;
  };
  checkIn: {
    lateGraceMins: number;
    blockAfterEnd: boolean;
    requireQr: boolean;
    qrExpiresAfterMins: number;
  };
  violations: Record<ViolationType, ViolationPolicy>;
};

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  version: 1,
  repeatWindowDays: 180,
  booking: {
    sportParticipantRules: {
      PADEL: { min: 4, max: 8 },
      BASKETBALL: { allowedTotals: [6, 10] },
      FOOTBALL: { min: 8, max: 15 },
      TENNIS: { min: 4, max: 8 },
      VOLLEYBALL: { min: 10, max: 15 },
      TABLE_TENNIS: { min: 2, max: 8 },
      BILLIARDS: { min: 2, max: 4 },
      AIR_HOCKEY: { exact: 2 },
    },
  },
  checkIn: {
    lateGraceMins: 5,
    blockAfterEnd: true,
    requireQr: true,
    qrExpiresAfterMins: 180,
  },
  violations: {
    LATE_ARRIVAL: {
      severity: ViolationSeverity.MINOR,
      escalation: [
        { type: PenaltyType.WARNING, note: "Late arrival warning" },
        { type: PenaltyType.BAN, durationDays: 3, note: "Repeated late arrival" },
        { type: PenaltyType.BAN, durationDays: 30, note: "Chronic late arrival" },
      ],
    },
    EQUIPMENT_DAMAGE: {
      severity: ViolationSeverity.MAJOR,
      escalation: [
        { type: PenaltyType.COMPENSATION, amount: 0, currency: Currency.EGP, note: "Damage compensation" },
        { type: PenaltyType.SUSPENSION, durationDays: 7, note: "Access suspended" },
        { type: PenaltyType.BAN, durationDays: 180, note: "Half-term ban" },
      ],
    },
    BEHAVIORAL: {
      severity: ViolationSeverity.MAJOR,
      escalation: [
        { type: PenaltyType.BAN, durationDays: 30, note: "Behavioral violation" },
        { type: PenaltyType.DISCIPLINARY_REFERRAL, note: "Referred to disciplinary committee" },
        { type: PenaltyType.BAN, durationDays: 180, note: "Half-term ban" },
      ],
    },
    PHYSICAL_ASSAULT: {
      severity: ViolationSeverity.CRITICAL,
      escalation: [
        { type: PenaltyType.DISCIPLINARY_REFERRAL, note: "Immediate escalation" },
        { type: PenaltyType.BAN, durationDays: 180, note: "Half-term ban" },
      ],
    },
    FOOD_DRINK: {
      severity: ViolationSeverity.MINOR,
      escalation: [
        { type: PenaltyType.WARNING, note: "Food/drink warning" },
        { type: PenaltyType.BAN, durationDays: 3, note: "Repeated food/drink violation" },
        { type: PenaltyType.BAN, durationDays: 30, note: "Chronic food/drink violation" },
      ],
    },
    UNSUITABLE_SHOES: {
      severity: ViolationSeverity.MINOR,
      escalation: [
        { type: PenaltyType.WARNING, note: "Unsuitable shoes warning" },
        { type: PenaltyType.BAN, durationDays: 30, note: "Repeated unsuitable shoes" },
        { type: PenaltyType.BAN, durationDays: 180, note: "Half-term ban" },
      ],
    },
    NO_BOOKING: {
      severity: ViolationSeverity.MAJOR,
      escalation: [
        { type: PenaltyType.WARNING, note: "Court access without booking" },
        { type: PenaltyType.BAN, durationDays: 3, note: "Repeated no-booking access" },
        { type: PenaltyType.BAN, durationDays: 30, note: "Chronic no-booking access" },
      ],
    },
    SMOKING: {
      severity: ViolationSeverity.MAJOR,
      escalation: [
        { type: PenaltyType.BAN, durationDays: 30, note: "Smoking violation" },
        { type: PenaltyType.BAN, durationDays: 180, note: "Repeat smoking violation" },
      ],
    },
    FACILITY_RULE_BREACH: {
      severity: ViolationSeverity.MINOR,
      escalation: [
        { type: PenaltyType.WARNING, note: "Facility rules violation" },
        { type: PenaltyType.BAN, durationDays: 3, note: "Repeated facility rule breach" },
        { type: PenaltyType.BAN, durationDays: 30, note: "Chronic facility rule breach" },
      ],
    },
  },
};

export function normalizeSportKey(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}
