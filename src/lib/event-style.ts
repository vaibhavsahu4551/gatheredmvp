export type EventTypeStyle = {
  gradient: string;
  ring: string;
  tint: string;
  fg: string;
};

const DEFAULT: EventTypeStyle = {
  gradient: "linear-gradient(135deg,#8E2DE2,#4A00E0)",
  ring: "#6B46FF",
  tint: "linear-gradient(180deg,#F4EEFF 0%,#FFFFFF 60%)",
  fg: "#ffffff",
};

export const EVENT_TYPE_STYLE: Record<string, EventTypeStyle> = {
  Breakfast: {
    gradient: "linear-gradient(135deg,#FFB347 0%,#FF7E5F 100%)",
    ring: "#FF7E5F",
    tint: "linear-gradient(180deg,#FFF1E4 0%,#FFFFFF 65%)",
    fg: "#3a1a05",
  },
  Lunch: {
    gradient: "linear-gradient(135deg,#FFD26F 0%,#F26F52 100%)",
    ring: "#F26F52",
    tint: "linear-gradient(180deg,#FFF3DA 0%,#FFFFFF 65%)",
    fg: "#3a1a05",
  },
  Dinner: {
    gradient: "linear-gradient(135deg,#FF5A5F 0%,#C7365F 100%)",
    ring: "#FF5A5F",
    tint: "linear-gradient(180deg,#FFE4E6 0%,#FFFFFF 65%)",
    fg: "#ffffff",
  },
  Drinks: {
    gradient: "linear-gradient(135deg,#7B5CFF 0%,#4B2AC7 100%)",
    ring: "#7B5CFF",
    tint: "linear-gradient(180deg,#EFEAFF 0%,#FFFFFF 65%)",
    fg: "#ffffff",
  },
  Club: {
    gradient: "linear-gradient(135deg,#FF2D95 0%,#7B2CFF 100%)",
    ring: "#FF2D95",
    tint: "linear-gradient(180deg,#FFE1F1 0%,#FFFFFF 65%)",
    fg: "#ffffff",
  },
  Gaming: {
    gradient: "linear-gradient(135deg,#00D2FF 0%,#3A47D5 100%)",
    ring: "#3A47D5",
    tint: "linear-gradient(180deg,#DDF6FF 0%,#FFFFFF 65%)",
    fg: "#ffffff",
  },
  Movies: {
    gradient: "linear-gradient(135deg,#F45B69 0%,#2E2A6B 100%)",
    ring: "#2E2A6B",
    tint: "linear-gradient(180deg,#FDE3E6 0%,#FFFFFF 65%)",
    fg: "#ffffff",
  },
  Trek: {
    gradient: "linear-gradient(135deg,#43C6AC 0%,#0E7C66 100%)",
    ring: "#0E7C66",
    tint: "linear-gradient(180deg,#DBF5EE 0%,#FFFFFF 65%)",
    fg: "#ffffff",
  },
  Other: DEFAULT,
};

export function eventTypeStyle(type?: string | null): EventTypeStyle {
  if (!type) return DEFAULT;
  return EVENT_TYPE_STYLE[type] ?? DEFAULT;
}
