import dayjs from "dayjs";

export function parseClock(clock: string): { hours: number; minutes: number } {
  const [h, m] = clock.split(":").map(Number);
  return { hours: h, minutes: m };
}

export function isWithinOperatingHours(start: Date, end: Date, open: string, close: string): boolean {
  const { hours: oh, minutes: om } = parseClock(open);
  const { hours: ch, minutes: cm } = parseClock(close);

  const dayStart = dayjs(start).hour(oh).minute(om).second(0).millisecond(0);
  const dayEnd = dayjs(start).hour(ch).minute(cm).second(0).millisecond(0);

  return dayjs(start).isSameOrAfter(dayStart) && dayjs(end).isSameOrBefore(dayEnd);
}
