export const STORE_TIME_ZONE = "America/Guayaquil"

const DELIVERY_OPEN_DAYS = new Set([0, 3, 4, 5, 6])
const DELIVERY_OPEN_MINUTE = 17 * 60
const DELIVERY_CLOSE_MINUTE = 2 * 60
const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
]

export type StoreHoursStatus = {
  isOpen: boolean
  nextOpening?: string
}

export function getStoreHoursStatus(now = new Date()): StoreHoursStatus {
  const localTime = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const weekday = localTime.find((part) => part.type === "weekday")?.value
  const hour = Number(localTime.find((part) => part.type === "hour")?.value)
  const minute = Number(localTime.find((part) => part.type === "minute")?.value)
  const weekdayIndex = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ].indexOf(weekday ?? "")
  const minuteOfDay = hour * 60 + minute

  if (weekdayIndex < 0) {
    throw new Error("No se pudo determinar la hora local de la tienda.")
  }

  const previousWeekday = (weekdayIndex + 6) % 7
  const isOpenNow =
    (DELIVERY_OPEN_DAYS.has(weekdayIndex) &&
      minuteOfDay >= DELIVERY_OPEN_MINUTE) ||
    (DELIVERY_OPEN_DAYS.has(previousWeekday) &&
      minuteOfDay < DELIVERY_CLOSE_MINUTE)

  if (isOpenNow) {
    return { isOpen: true }
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateWeekday = (weekdayIndex + offset) % 7
    const openingHasPassedToday =
      offset === 0 && minuteOfDay >= DELIVERY_OPEN_MINUTE

    if (DELIVERY_OPEN_DAYS.has(candidateWeekday) && !openingHasPassedToday) {
      const openingDay =
        offset === 0 ? "hoy" : `el ${WEEKDAYS[candidateWeekday]}`
      return { isOpen: false, nextOpening: `${openingDay} a las 17:00` }
    }
  }

  throw new Error("No se pudo calcular la próxima apertura de la tienda.")
}
