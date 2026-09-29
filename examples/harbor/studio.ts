export interface ClassSlot {
  classId: string;
  title: string;
  date: string;
  start: string;
  durationMinutes: number;
  priceUsd: number;
  seats: number;
}

export interface Booking {
  bookingId: string;
  classId: string;
  name: string;
  seats: number;
}

export const STUDIO = {
  name: "Clay & Co.",
  address: "48 Harbor Street, Portland",
  hours: "Tuesday to Sunday, 9:00 to 21:00. Closed on Mondays.",
  cancellation:
    "Free cancellation up to 24 hours before the class. Later cancellations are not refunded.",
  discounts: "No discounts or promo codes are available.",
  catalog: [
    { title: "Wheel Throwing for Beginners", durationMinutes: 90, priceUsd: 45 },
    { title: "Hand Building", durationMinutes: 90, priceUsd: 38 },
    { title: "Glazing Workshop", durationMinutes: 120, priceUsd: 40 },
  ],
} as const;

const SCHEDULE: readonly ClassSlot[] = [
  {
    classId: "wheel-1003-am",
    title: "Wheel Throwing for Beginners",
    date: "2026-10-03",
    start: "10:00",
    durationMinutes: 90,
    priceUsd: 45,
    seats: 3,
  },
  {
    classId: "glaze-1003-pm",
    title: "Glazing Workshop",
    date: "2026-10-03",
    start: "18:30",
    durationMinutes: 120,
    priceUsd: 40,
    seats: 0,
  },
  {
    classId: "hand-1004-am",
    title: "Hand Building",
    date: "2026-10-04",
    start: "11:00",
    durationMinutes: 90,
    priceUsd: 38,
    seats: 6,
  },
  {
    classId: "wheel-1004-pm",
    title: "Wheel Throwing for Beginners",
    date: "2026-10-04",
    start: "16:00",
    durationMinutes: 90,
    priceUsd: 45,
    seats: 2,
  },
];

const EXISTING_BOOKINGS: readonly Booking[] = [
  { bookingId: "HB-1042", classId: "hand-1004-am", name: "Leo Park", seats: 1 },
];

/** An in-memory studio calendar. Each conversation gets a fresh copy. */
export class Studio {
  private readonly slots = new Map(SCHEDULE.map((slot) => [slot.classId, { ...slot }]));
  private readonly bookings = new Map(
    EXISTING_BOOKINGS.map((booking) => [booking.bookingId, { ...booking }]),
  );
  private nextId = 1100;

  availability(date: string): ClassSlot[] {
    return [...this.slots.values()].filter((slot) => slot.date === date);
  }

  book(
    classId: string,
    name: string,
    seats: number,
  ): Booking & { title: string; date: string; start: string; totalUsd: number } {
    const slot = this.slots.get(classId);
    if (slot === undefined) throw new Error(`Unknown class ${classId}`);
    if (slot.seats < seats) {
      throw new Error(`Only ${String(slot.seats)} seats left in ${slot.title} on ${slot.date}`);
    }
    slot.seats -= seats;
    this.nextId += 1;
    const booking = { bookingId: `HB-${String(this.nextId)}`, classId, name, seats };
    this.bookings.set(booking.bookingId, booking);
    return {
      ...booking,
      title: slot.title,
      date: slot.date,
      start: slot.start,
      totalUsd: slot.priceUsd * seats,
    };
  }

  cancel(bookingId: string): { bookingId: string; refunded: boolean; policy: string } {
    const booking = this.bookings.get(bookingId);
    if (booking === undefined) throw new Error(`No booking ${bookingId}`);
    const slot = this.slots.get(booking.classId);
    if (slot !== undefined) slot.seats += booking.seats;
    this.bookings.delete(bookingId);
    return { bookingId, refunded: true, policy: STUDIO.cancellation };
  }
}
