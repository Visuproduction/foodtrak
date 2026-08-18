/**
 * Algorithme de calcul des créneaux horaires disponibles.
 * Tranches configurables (défaut 10 min) selon la capacité du commerçant.
 */

export interface SlotCalculatorConfig {
  /** Capacité max de commandes par créneau */
  capacityPerSlot: number;
  /** Durée d'un créneau en minutes */
  slotDurationMinutes: number;
  /** Heure d'ouverture (0-23) */
  openHour?: number;
  /** Heure de fermeture (0-23) */
  closeHour?: number;
  /** Nombre d'heures à planifier à l'avance */
  horizonHours?: number;
  /** Temps minimum avant le premier créneau (minutes) */
  minLeadTimeMinutes?: number;
}

export interface ExistingOrderSlot {
  pickupTime: Date;
}

export interface ComputedSlot {
  start: Date;
  end: Date;
  /** Créneau sélectionnable par le client */
  available: boolean;
  /** Places restantes dans ce créneau */
  remainingCapacity: number;
  /** Nombre de commandes déjà planifiées */
  bookedCount: number;
}

function roundUpToSlot(date: Date, slotMinutes: number): Date {
  const ms = slotMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isSameSlot(a: Date, b: Date, slotMinutes: number): boolean {
  const slotMs = slotMinutes * 60 * 1000;
  return Math.floor(a.getTime() / slotMs) === Math.floor(b.getTime() / slotMs);
}

/**
 * Compte les commandes existantes par créneau.
 */
function countBookingsForSlot(
  slotStart: Date,
  existingOrders: ExistingOrderSlot[],
  slotDurationMinutes: number
): number {
  return existingOrders.filter((order) =>
    isSameSlot(order.pickupTime, slotStart, slotDurationMinutes)
  ).length;
}

/**
 * Calcule tous les créneaux disponibles pour une journée / horizon donné.
 */
export function calculateAvailableSlots(
  config: SlotCalculatorConfig,
  existingOrders: ExistingOrderSlot[] = [],
  referenceDate: Date = new Date()
): ComputedSlot[] {
  const {
    capacityPerSlot,
    slotDurationMinutes,
    openHour = 11,
    closeHour = 22,
    horizonHours = 4,
    minLeadTimeMinutes = 15,
  } = config;

  const slots: ComputedSlot[] = [];
  const now = referenceDate;

  // Premier créneau possible = maintenant + délai minimum, arrondi au slot
  const earliest = roundUpToSlot(
    addMinutes(now, minLeadTimeMinutes),
    slotDurationMinutes
  );

  const horizonEnd = addMinutes(now, horizonHours * 60);

  let cursor = new Date(earliest);

  while (cursor <= horizonEnd) {
    const hour = cursor.getHours();
    const withinBusinessHours = hour >= openHour && hour < closeHour;

    const bookedCount = countBookingsForSlot(
      cursor,
      existingOrders,
      slotDurationMinutes
    );

    const remainingCapacity = Math.max(0, capacityPerSlot - bookedCount);
    const available = withinBusinessHours && remainingCapacity > 0;

    slots.push({
      start: new Date(cursor),
      end: addMinutes(cursor, slotDurationMinutes),
      available,
      remainingCapacity,
      bookedCount,
    });

    cursor = addMinutes(cursor, slotDurationMinutes);
  }

  return slots;
}

/**
 * Retourne uniquement les créneaux disponibles (filtrés).
 */
export function getAvailableSlotsOnly(
  config: SlotCalculatorConfig,
  existingOrders: ExistingOrderSlot[] = [],
  referenceDate?: Date
): ComputedSlot[] {
  return calculateAvailableSlots(config, existingOrders, referenceDate).filter(
    (slot) => slot.available
  );
}

/**
 * Vérifie qu'un créneau choisi est toujours valide (anti race-condition).
 */
export function isSlotStillAvailable(
  pickupTime: Date,
  config: SlotCalculatorConfig,
  existingOrders: ExistingOrderSlot[] = [],
  referenceDate?: Date
): boolean {
  const slots = calculateAvailableSlots(config, existingOrders, referenceDate);
  return slots.some(
    (slot) =>
      slot.start.getTime() === pickupTime.getTime() && slot.available
  );
}

/**
 * Trouve le prochain créneau disponible.
 */
export function getNextAvailableSlot(
  config: SlotCalculatorConfig,
  existingOrders: ExistingOrderSlot[] = [],
  referenceDate?: Date
): ComputedSlot | null {
  const available = getAvailableSlotsOnly(config, existingOrders, referenceDate);
  return available[0] ?? null;
}
