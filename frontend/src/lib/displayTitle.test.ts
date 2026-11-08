import { describe, expect, it } from "vitest";
import { capAtWord, displayTitle, isIdLike, titleFromCaption } from "./displayTitle";

// Real records from the archive (captions shortened).
const source = (title: string, nasa_id: string, description: string) => ({ title, nasa_id, description });

describe("isIdLike", () => {
  it("spots NASA IDs", () => {
    for (const id of ["iss071e608493", "KSC-98pc637", "jsc2018e025510", "ARC-2011-ACD11-0035-024", "2010-4372", "1100173"]) {
      expect(isIdLike(id)).toBe(true);
    }
  });

  it("leaves real names alone", () => {
    for (const title of ["Gale Crater", "STS-135", "2014 NASM Event", "Artemis-2 Heat Shield Arrival"]) {
      expect(isIdLike(title)).toBe(false);
    }
  });
});

describe("displayTitle", () => {
  it("keeps a real title", () => {
    expect(displayTitle(source("Gale Crater", "PIA22505", "While far from the rover…"))).toBe("Gale Crater");
  });

  it("strips the ID, the date and the --- from an ISS caption", () => {
    const iss = source(
      "iss071e608493",
      "iss071e608493",
      "iss071e608493 (Sept. 4, 2024) --- NASA astronaut Suni Williams configures portable electronics gear aboard the International Space Station's Destiny laboratory module.",
    );
    expect(displayTitle(iss)).toBe("NASA astronaut Suni Williams configures portable…");
  });

  it("strips a Kennedy dateline and uses the first sentence when it fits", () => {
    const ksc = source(
      "KSC-2011-1022",
      "KSC-2011-1022",
      "CAPE CANAVERAL, Fla. -- A great blue heron wades in the water. Photo credit: NASA",
    );
    expect(displayTitle(ksc)).toBe("A great blue heron wades in the water");
  });

  it("uses the first clause when the sentence is long and the clause says enough", () => {
    const iss = source(
      "iss034e010621",
      "iss034e010621",
      "ISS034-E-010621 (31 Dec. 2012) --- Canadian Space Agency astronaut Chris Hadfield, Expedition 34 flight engineer, performs a periodic fitness evaluation.",
    );
    expect(displayTitle(iss)).toBe("Canadian Space Agency astronaut Chris Hadfield");
  });

  it("does not stop at an abbreviation", () => {
    const ksc = source("KSC-07pd1929", "KSC-07pd1929", "KENNEDY SPACE CENTER, Fla. -- Dr. Kelly climbs aboard. More text.");
    expect(displayTitle(ksc)).toBe("Dr. Kelly climbs aboard");
  });

  it("calms down an all-caps caption but keeps acronyms and mission names", () => {
    expect(displayTitle(source("2010-4372", "2010-4372", "STS-134 LEFT FORWARD CENTER (LFC) SRB STACKING"))).toBe(
      "STS-134 left forward center (LFC) SRB stacking",
    );
    expect(displayTitle(source("1100173", "1100173", "THE EXPLORATION EXPERIENCE PAVILION AT SCIQUEST"))).toBe(
      "The exploration experience pavilion at sciquest",
    );
  });

  it("keeps the subject of a 'PHOTO DATE: … SUBJECT:' caption", () => {
    const jsc = source(
      "jsc2013e088075",
      "jsc2013e088075",
      "PHOTO DATE:  09-17-13 LOCATION: NBL - Pool Topside  SUBJECT: Expedition 40/41 crew members during a briefing PHOTOGRAPHER: Lauren Harnett",
    );
    expect(displayTitle(jsc)).toBe("Expedition 40/41 crew members during a briefing");
  });

  it("stops at a semicolon", () => {
    const arc = source("ARC-1950-A-15464", "ARC-1950-A-15464", "Aileron control; EYF-84 (No. 559488) airplane, differential pressure.");
    expect(displayTitle(arc)).toBe("Aileron control");
  });

  it("shortens a whole caption pasted in as the title", () => {
    const caption =
      "jsc2017e135207 - At the Gagarin Cosmonaut Training Center in Star City, Russia, Expedition 54-55 prime crewmember Norishige Kanai listens to a question.";
    const title = displayTitle(source(caption, "jsc2017e135207", caption));
    expect(title).toBe("At the Gagarin Cosmonaut Training Center in Star City…");
  });

  it("falls back to the ID when the caption has nothing better", () => {
    expect(displayTitle(source("KSC-98pc637", "KSC-98pc637", "KSC-98pc637"))).toBe("KSC-98pc637");
    expect(displayTitle(source("KSC-98pc637", "KSC-98pc637", ""))).toBe("KSC-98pc637");
  });
});

describe("capAtWord", () => {
  it("cuts at a word boundary and drops trailing punctuation", () => {
    expect(capAtWord("Space shuttle Endeavour, mounted atop the carrier aircraft", 30)).toBe("Space shuttle Endeavour…");
    expect(capAtWord("Short", 30)).toBe("Short");
  });
});

describe("titleFromCaption", () => {
  it("returns an empty string for an empty caption", () => {
    expect(titleFromCaption("  ")).toBe("");
  });
});
