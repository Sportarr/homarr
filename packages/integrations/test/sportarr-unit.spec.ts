// @vitest-environment node

import { describe, expect, test, vi } from "vitest";

import { createDb } from "@homarr/db/test";
import { fetchWithTrustedCertificatesAsync } from "@homarr/core/infrastructure/http";

import { SonarrIntegration } from "../src/media-organizer/sonarr/sonarr-integration";
import { SportarrIntegration } from "../src/media-organizer/sportarr/sportarr-integration";

vi.mock("@homarr/db", async (importActual) => {
  const actual = await importActual<typeof import("@homarr/db")>();
  return { ...actual, db: createDb() };
});

vi.mock("@homarr/core/infrastructure/certificates", async (importActual) => {
  const actual = await importActual<typeof import("@homarr/core/infrastructure/certificates")>();
  return {
    ...actual,
    getTrustedCertificateHostnamesAsync: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@homarr/core/infrastructure/http", () => ({
  fetchWithTrustedCertificatesAsync: vi.fn(),
}));

const mockFetch = vi.mocked(fetchWithTrustedCertificatesAsync);

const sportarrIntegrationInput = {
  id: "test-sportarr",
  name: "Sportarr",
  url: "http://localhost:1867",
  decryptedSecrets: [{ kind: "apiKey" as const, value: "test-key" }],
  externalUrl: null,
};

const createCalendarEvent = (seasonNumber: number, episodeNumber: number) => [
  {
    title: "UFC 330 Makhachev vs Machado Garry",
    airDateUtc: "2026-08-15T00:00:00Z",
    seasonNumber,
    episodeNumber,
    series: {
      title: "UFC",
      titleSlug: "ufc",
      overview: "Mixed martial arts",
      images: [{ coverType: "poster", remoteUrl: "https://example.com/poster.jpg" }],
    },
    images: [],
  },
];

describe("SportarrIntegration calendar branding", () => {
  test("calendar link uses the Sportarr name and logo", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createCalendarEvent(2026, 43)),
    } as never);

    const integration = new SportarrIntegration(sportarrIntegrationInput);
    const events = await integration.getCalendarEventsAsync(new Date("2026-08-01"), new Date("2026-08-31"));

    expect(events[0]?.links[0]).toMatchObject({
      name: "Sportarr",
      logo: "/images/apps/sportarr.svg",
    });
  });

  test("calendar badge shows only the episode for year-based seasons", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createCalendarEvent(2026, 43)),
    } as never);

    const integration = new SportarrIntegration(sportarrIntegrationInput);
    const events = await integration.getCalendarEventsAsync(new Date("2026-08-01"), new Date("2026-08-31"));

    expect(events[0]?.image?.badge?.content).toBe("E43");
  });

  test("does not affect SonarrIntegration's own calendar badge format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createCalendarEvent(1, 2)),
    } as never);

    const integration = new SonarrIntegration({
      ...sportarrIntegrationInput,
      id: "test-sonarr",
      name: "Sonarr",
      url: "http://localhost:8989",
    });
    const events = await integration.getCalendarEventsAsync(new Date("2026-08-01"), new Date("2026-08-31"));

    expect(events[0]?.image?.badge?.content).toBe("S1/E2");
    expect(events[0]?.links[0]).toMatchObject({ name: "Sonarr", logo: "/images/apps/sonarr.svg" });
  });

  test("event artwork carries into the calendar event", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createCalendarEvent(2026, 43)),
    } as never);

    const integration = new SportarrIntegration(sportarrIntegrationInput);
    const events = await integration.getCalendarEventsAsync(new Date("2026-08-01"), new Date("2026-08-31"));

    expect(events[0]?.image?.src).toBe("https://example.com/poster.jpg");
  });
});
