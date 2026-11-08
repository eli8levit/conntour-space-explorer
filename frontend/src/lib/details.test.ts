import { describe, expect, it } from "vitest";
import { eyebrow, parseCaption, sizeLabel } from "./details";

describe("parseCaption", () => {
  it("moves the Mars key/value tail and the link into fields", () => {
    const parts = parseCaption(
      "While far from the rover, this VIS image of Gale Crater covers the deposit.  Orbit Number: 72297 Latitude: -5.20235 Longitude: 138.126 Instrument: VIS Captured: 2018-04-02 02:54  https://photojournal.jpl.nasa.gov/catalog/PIA22505",
    );
    expect(parts).toEqual({
      text: "While far from the rover, this VIS image of Gale Crater covers the deposit.",
      instrument: "VIS",
      orbit: "72297",
      captured: "2018-04-02 02:54",
      credit: null,
    });
  });

  it("moves a Kennedy photo credit into its own field", () => {
    const parts = parseCaption("Endeavour taxis down the runway.  Photo credit: NASA/Rusty Backer");
    expect(parts.text).toBe("Endeavour taxis down the runway.");
    expect(parts.credit).toBe("NASA/Rusty Backer");
  });

  it("drops a leading ID, its date and the dashes (they are shown as metadata)", () => {
    expect(parseCaption("iss071e608493 (Sept. 4, 2024) --- NASA astronaut Suni Williams works.").text).toBe(
      "NASA astronaut Suni Williams works.",
    );
  });

  it("leaves a plain caption alone", () => {
    expect(parseCaption("Lycus Sulci")).toEqual({
      text: "Lycus Sulci",
      instrument: null,
      orbit: null,
      captured: null,
      credit: null,
    });
  });
});

describe("eyebrow", () => {
  const place = { body: "mars" as const, lat: -5.2, lon: 138.1, label: "Gale Crater", provenance: "caption" as const };

  it("joins the body and the first keyword that adds something", () => {
    expect(eyebrow({ place, keywords: ["Mars", "2001 Mars Odyssey"], center: "JPL" })).toBe("Mars · 2001 Mars Odyssey");
  });

  it("falls back to the center", () => {
    expect(eyebrow({ place: null, keywords: [], center: "KSC" })).toBe("KSC");
  });
});

describe("sizeLabel", () => {
  it("shows the size only when the API has it", () => {
    expect(sizeLabel({ width: 660, height: 1280 })).toBe("660 × 1280 · medium");
    expect(sizeLabel({ width: null, height: null })).toBeNull();
  });
});
