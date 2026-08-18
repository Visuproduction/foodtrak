import { describe, it, expect } from "vitest";
import {
  calculateAvailableSlots,
  getAvailableSlotsOnly,
  getNextAvailableSlot,
  isSlotStillAvailable,
  type ExistingOrderSlot,
  type SlotCalculatorConfig,
} from "@/lib/slotCalculator";

const baseConfig: SlotCalculatorConfig = {
  capacityPerSlot: 3,
  slotDurationMinutes: 10,
  openHour: 11,
  closeHour: 22,
  horizonHours: 2,
  minLeadTimeMinutes: 15,
};

/** Date fixe : mardi 18 août 2026, 14:00 locale */
const referenceDate = new Date(2026, 7, 18, 14, 0, 0);

function slotAt(hour: number, minute: number): Date {
  return new Date(2026, 7, 18, hour, minute, 0);
}

describe("slotCalculator", () => {
  describe("calculateAvailableSlots", () => {
    it("génère des créneaux par tranches de 10 min", () => {
      const slots = calculateAvailableSlots(baseConfig, [], referenceDate);

      expect(slots.length).toBeGreaterThan(0);

      for (let i = 1; i < slots.length; i++) {
        const diff =
          slots[i].start.getTime() - slots[i - 1].start.getTime();
        expect(diff).toBe(10 * 60 * 1000);
      }
    });

    it("respecte le délai minimum de 15 min avant le 1er créneau", () => {
      const slots = getAvailableSlotsOnly(baseConfig, [], referenceDate);
      const first = slots[0];

      expect(first.start.getTime()).toBeGreaterThanOrEqual(
        referenceDate.getTime() + 15 * 60 * 1000
      );
    });

    it("marque indisponibles les créneaux hors horaires d'ouverture", () => {
      const slots = calculateAvailableSlots(
        { ...baseConfig, openHour: 11, closeHour: 15, horizonHours: 6 },
        [],
        referenceDate
      );

      const afterClose = slots.filter((s) => s.start.getHours() >= 15);
      expect(afterClose.every((s) => !s.available)).toBe(true);
    });

    it("réduit la capacité restante quand des commandes existent", () => {
      const targetSlot = slotAt(14, 30);
      const existing: ExistingOrderSlot[] = [
        { pickupTime: targetSlot },
        { pickupTime: targetSlot },
      ];

      const slots = calculateAvailableSlots(
        baseConfig,
        existing,
        referenceDate
      );

      const slot = slots.find(
        (s) => s.start.getTime() === targetSlot.getTime()
      );

      expect(slot).toBeDefined();
      expect(slot!.bookedCount).toBe(2);
      expect(slot!.remainingCapacity).toBe(1);
      expect(slot!.available).toBe(true);
    });

    it("marque complet un créneau à capacité max", () => {
      const targetSlot = slotAt(14, 30);
      const existing: ExistingOrderSlot[] = Array.from({ length: 3 }, () => ({
        pickupTime: targetSlot,
      }));

      const slots = calculateAvailableSlots(
        baseConfig,
        existing,
        referenceDate
      );

      const slot = slots.find(
        (s) => s.start.getTime() === targetSlot.getTime()
      );

      expect(slot!.remainingCapacity).toBe(0);
      expect(slot!.available).toBe(false);
    });
  });

  describe("getAvailableSlotsOnly", () => {
    it("ne retourne que les créneaux disponibles", () => {
      const targetSlot = slotAt(14, 30);
      const existing: ExistingOrderSlot[] = Array.from({ length: 3 }, () => ({
        pickupTime: targetSlot,
      }));

      const available = getAvailableSlotsOnly(
        baseConfig,
        existing,
        referenceDate
      );

      expect(available.every((s) => s.available)).toBe(true);
      expect(
        available.some((s) => s.start.getTime() === targetSlot.getTime())
      ).toBe(false);
    });
  });

  describe("isSlotStillAvailable", () => {
    it("retourne true si le créneau a de la place", () => {
      const pickup = slotAt(14, 30);
      const result = isSlotStillAvailable(pickup, baseConfig, [], referenceDate);
      expect(result).toBe(true);
    });

    it("retourne false si le créneau est plein", () => {
      const pickup = slotAt(14, 30);
      const existing: ExistingOrderSlot[] = Array.from({ length: 3 }, () => ({
        pickupTime: pickup,
      }));

      const result = isSlotStillAvailable(
        pickup,
        baseConfig,
        existing,
        referenceDate
      );
      expect(result).toBe(false);
    });

    it("retourne false pour un créneau hors horaires", () => {
      const pickup = slotAt(23, 0);
      const result = isSlotStillAvailable(
        pickup,
        baseConfig,
        [],
        referenceDate
      );
      expect(result).toBe(false);
    });
  });

  describe("getNextAvailableSlot", () => {
    it("retourne le premier créneau disponible", () => {
      const next = getNextAvailableSlot(baseConfig, [], referenceDate);
      const all = getAvailableSlotsOnly(baseConfig, [], referenceDate);

      expect(next).not.toBeNull();
      expect(next!.start.getTime()).toBe(all[0].start.getTime());
    });

    it("retourne null si aucun créneau disponible", () => {
      const config: SlotCalculatorConfig = {
        ...baseConfig,
        openHour: 11,
        closeHour: 12,
        horizonHours: 1,
      };

      const next = getNextAvailableSlot(config, [], referenceDate);
      expect(next).toBeNull();
    });
  });
});
