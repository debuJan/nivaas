import { describe, expect, it } from "vitest";
import { classifyComplaint, findDuplicates, type ExistingComplaint } from "./classify";

describe("classifyComplaint — safety first", () => {
  it("gas smell escalates to CRITICAL whatever else the text says", () => {
    const c = classifyComplaint("Strong smell of gas near the kitchen, please send someone");
    expect(c.escalated).toBe(true);
    expect(c.urgency).toBe("CRITICAL");
  });

  it("a burst pipe forces CRITICAL even though it is 'just' plumbing", () => {
    const c = classifyComplaint("Burst pipe in the bathroom, water flooding the flat");
    expect(c.category).toBe("PLUMBING");
    expect(c.urgency).toBe("CRITICAL");
    expect(c.escalated).toBe(true);
  });

  it("lift stuck with people inside is LIFT + CRITICAL", () => {
    const c = classifyComplaint("Lift stuck between floors, people inside shouting");
    expect(c.category).toBe("LIFT");
    expect(c.urgency).toBe("CRITICAL");
    expect(c.escalated).toBe(true);
  });

  it("electric shock escalates as ELECTRICAL + CRITICAL", () => {
    const c = classifyComplaint("Got an electric shock from the bathroom switch");
    expect(c.category).toBe("ELECTRICAL");
    expect(c.urgency).toBe("CRITICAL");
  });
});

describe("classifyComplaint — normal scoring", () => {
  it("a water leak is PLUMBING with usable confidence", () => {
    const c = classifyComplaint("Water leak from the bathroom tap since two days");
    expect(c.category).toBe("PLUMBING");
    expect(c.escalated).toBe(false);
    expect(c.confidence).toBeGreaterThanOrEqual(0.5);
    expect(c.urgency).toBe("MEDIUM"); // "since ... days"
  });

  it("a dead fan and light point to ELECTRICAL, calm text stays LOW", () => {
    const c = classifyComplaint("Bedroom fan and light not switching on");
    expect(c.category).toBe("ELECTRICAL");
  });

  it("gibberish falls back to OTHER with low confidence", () => {
    const c = classifyComplaint("zxqw blorp fnord wibble");
    expect(c.category).toBe("OTHER");
    expect(c.confidence).toBeLessThan(0.5);
  });

  it("one weak shared word is not enough to commit a category", () => {
    const c = classifyComplaint("The door makes a sound sometimes");
    expect(c.category).toBe("OTHER");
    expect(c.confidence).toBeLessThan(0.5);
  });
});

describe("findDuplicates — the T12 lift cluster", () => {
  const now = new Date("2026-11-10T10:00:00Z");
  const existing: ExistingComplaint[] = [
    {
      id: "lift-1",
      text: "Lift not working since morning in our tower",
      tower: "T12",
      createdAt: new Date("2026-11-09T09:00:00Z"),
    },
    {
      id: "lift-2",
      text: "Lift not working in our tower, stuck since morning",
      tower: "T12",
      createdAt: new Date("2026-11-09T14:00:00Z"),
    },
    {
      id: "lift-t21",
      text: "Lift not working since morning in our tower",
      tower: "T21", // same words, different tower — not a duplicate
      createdAt: new Date("2026-11-10T09:00:00Z"),
    },
    {
      id: "lift-old",
      text: "Lift not working since morning in our tower",
      tower: "T12", // same tower but 5 days old — outside the 72h window
      createdAt: new Date("2026-11-05T09:00:00Z"),
    },
    {
      id: "garbage-1",
      text: "Garbage not collected near the dustbin today",
      tower: "T12",
      createdAt: new Date("2026-11-10T08:00:00Z"),
    },
  ];

  it("links the same-tower lift complaints inside 72h", () => {
    const ids = findDuplicates("Lift not working since morning", "T12", now, existing);
    expect(ids).toContain("lift-1");
    expect(ids).toContain("lift-2");
  });

  it("does not link other towers, old complaints, or unrelated topics", () => {
    const ids = findDuplicates("Lift not working since morning", "T12", now, existing);
    expect(ids).not.toContain("lift-t21");
    expect(ids).not.toContain("lift-old");
    expect(ids).not.toContain("garbage-1");
  });

  it("an unrelated new complaint is not flagged as a duplicate", () => {
    const ids = findDuplicates(
      "Garbage is stinking near the dustbin, needs cleaning",
      "T12",
      now,
      existing,
    );
    expect(ids).not.toContain("lift-1");
    expect(ids).not.toContain("lift-2");
  });
});
