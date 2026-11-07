
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
});

type Country = {
  name: {
    common: string;
    official: string;
  };
  cca3: string;
  cca2: string;
  capital?: string[];
  population: number | null;
  currencies?: Record<string, { name: string; symbol?: string }>;
  languages?: Record<string, string>;
  region: string;
  subregion?: string;
  latlng: number[];
  flags?: {
    svg?: string;
    png?: string;
  };
};

// Einwohnerzahlen formatieren
const fmt = (n: number | null | undefined) => {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return "Keine Angabe";
  }

  return new Intl.NumberFormat("de-DE").format(n);
};

// Deutsche Ländernamen
const getGermanName = (country: Country) => {
  try {
    const names = new Intl.DisplayNames(["de"], {
      type: "region",
    });

    return names.of(country.cca3) || country.name.common;
  } catch {
    return country.name.common;
  }
};

export default function EarthExplorer() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selected, setSelected] = useState<Country | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);

  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  // Länder und Bevölkerungsdaten laden
  useEffect(() => {
    const controller = new AbortController();

    async function loadCountries() {
      try {
        setLoading(true);
        setError("");

        // Länderinformationen laden
        const countriesResponse = await fetch(
          "https://raw.githubusercontent.com/mledoze/countries/master/countries.json",
          { signal: controller.signal }
        );

        if (!countriesResponse.ok) {
          throw new Error("Länderdaten konnten nicht geladen werden.");
        }

        const rawCountries = await countriesResponse.json();

        // Bevölkerungsdaten der Weltbank laden
        const populationResponse = await fetch(
          "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000",
          { signal: controller.signal }
        );

        if (!populationResponse.ok) {
          throw new Error("Bevölkerungsdaten konnten nicht geladen werden.");
        }

        const populationJson = await populationResponse.json();

        // Neueste verfügbare Einwohnerzahl je Land
        const populationMap = new Map<
          string,
          { value: number; year: number }
        >();

        if (Array.isArray(populationJson[1])) {
          for (const entry of populationJson[1]) {
            const code = entry.countryiso3code;
            const value = entry.value;
            const year = Number(entry.date);

            if (
              code &&
              typeof value === "number" &&
              Number.isFinite(value) &&
              Number.isFinite(year)
            ) {
              const existing = populationMap.get(code);

              if (!existing || year > existing.year) {
                populationMap.set(code, {
                  value,
                  year,
                });
              }
            }
          }
        }

        // Länder und Einwohnerzahlen zusammenführen
        const data: Country[] = rawCountries.map((c: any) => ({
          ...c,
          population: populationMap.get(c.cca3)?.value ?? null,
        }));

        const validCountries = data.filter(
          (c) =>
            c.name?.common &&
            c.name?.official &&
            c.cca3 &&
            c.cca2 &&
            Array.isArray(c.latlng) &&
            c.latlng.length === 2
        );

        if (validCountries.length === 0) {
          throw new Error("Keine gültigen Länder gefunden.");
        }

        setCountries(validCountries);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;

        setError(
          e instanceof Error
            ? e.message
            : "Unbekannter Fehler beim Laden."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCountries();

    return () => controller.abort();
  }, []);

  // Automatische Rotation
  useEffect(() => {
    const controls = globeRef.current?.controls();

    if (controls) {
      controls.autoRotate = auto;
      controls.autoRotateSpeed = 0.35;
    }
  }, [auto]);

  // Länder suchen
  const filtered = useMemo(
    () =>
      countries.filter((c) => {
        const search = query.toLowerCase().trim();

        return (
          c.name.common.toLowerCase().includes(search) ||
          c.name.official.toLowerCase().includes(search) ||
          getGermanName(c).toLowerCase().includes(search)
        );
      }),
    [countries, query]
  );

  // Land auswählen
  const pick = (c: Country) => {
    setSelected(c);
    setQuery(c.name.common);

    globeRef.current?.pointOfView(
      {
        lat: c.latlng[0],
        lng: c.latlng[1],
        altitude: 1.6,
      },
      1200
    );
  };

  // Globus-Punkte
  const points = useMemo(
    () =>
      countries.map((c) => ({
        lat: c.latlng[0],
        lng: c.latlng[1],
        name: c.name.common,
        cca3: c.cca3,
      })),
    [countries]
  );

  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <span className="logo">🌐</span>
          <div>
            <h1>Our Earth</h1>
            <p>Entdecke unsere Welt – interaktiv und in 3D</p>
          </div>
        </div>

        <div className="status">
          <i />
          {loading
            ? "Länderdaten laden…"
            : error
              ? "Laden fehlgeschlagen"
              : `${countries.length} Länder verfügbar`}
        </div>
      </header>

      <section className="stage">
        <div className="globeWrap">
          <Globe
            ref={globeRef}
            width={
              typeof window !== "undefined"
                ? window.innerWidth
                : 1200
            }
            height={
              typeof window !== "undefined"
                ? Math.max(500, window.innerHeight - 110)
                : 700
            }
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
            polygonsData={[]}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={0.012}
            pointRadius={0.12}
            pointColor={() => "#62c8ff"}
            pointLabel="name"
            atmosphereColor="#5aaeff"
            atmosphereAltitude={0.18}
            onGlobeReady={() => {
              const controls = globeRef.current?.controls();

              if (controls) {
                controls.autoRotate = auto;
                controls.autoRotateSpeed = 0.35;
              }
            }}
            onPointClick={(p: any) => {
              const country = countries.find(
                (c) => c.cca3 === p.cca3
              );

              if (country) pick(country);
            }}
            animateIn={true}
          />
        </div>

        <aside className="panel left">
          <h2>🌍 Weltübersicht</h2>

          <div className="stat">
            <span>Oberfläche</span>
            <b>510,1 Mio. km²</b>
          </div>

          <div className="stat">
            <span>Bevölkerung</span>
            <b>≈ 8,1 Mrd.</b>
          </div>

          <div className="stat">
            <span>Länder</span>
            <b>{loading ? "…" : countries.length}</b>
          </div>

          <div className="stat">
            <span>Kontinente</span>
            <b>7</b>
          </div>

          <hr />

          <h3>Steuerung</h3>
          <p>🖱️ Ziehen zum Drehen</p>
          <p>↕️ Scrollen zum Zoomen</p>

          <button
            className="ghost"
            onClick={() =>
              globeRef.current?.pointOfView(
                { lat: 20, lng: 0, altitude: 2.5 },
                1000
              )
            }
          >
            Ansicht zurücksetzen
          </button>

          <button
            className="ghost"
            onClick={() => setAuto(!auto)}
          >
            {auto ? "Rotation pausieren" : "Rotation starten"}
          </button>
        </aside>

        <aside className="panel right">
          <h2>🔎 Land suchen</h2>

          <div className="search">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              placeholder="Land eingeben …"
            />
            <span>⌕</span>
          </div>

          {query && !selected && (
            <div className="results">
              {filtered.slice(0, 7).map((c) => (
                <button
                  key={c.cca3}
                  onClick={() => pick(c)}
                >
                  {c.name.common}
                  <small>{c.region}</small>
                </button>
              ))}

              {filtered.length === 0 && (
                <p>Kein Land gefunden.</p>
              )}
            </div>
          )}

          {selected ? (
            <div className="country">
              <div className="countryHead">
                <img
                  src={`https://flagcdn.com/w160/${selected.cca2.toLowerCase()}.png`}
                  alt={`Flagge ${selected.name.common}`}
                  width={80}
                  height={55}
                  style={{
                    objectFit: "contain",
                    borderRadius: "6px",
                  }}
                />

                <div>
                  <h3>{getGermanName(selected)}</h3>
                  <small>{selected.name.official}</small>
                </div>
              </div>

              <div className="detail">
                <label>Hauptstadt</label>
                <strong>
                  {selected.capital?.join(", ") || "Keine Angabe"}
                </strong>
              </div>

              <div className="detail">
                <label>Bevölkerung</label>
                <strong>
                  {fmt(selected.population)}
                </strong>
              </div>

              <div className="detail">
                <label>Währung</label>
                <strong>
                  {selected.currencies
                    ? Object.values(selected.currencies)
                        .map(
                          (x) =>
                            `${x.name}${x.symbol ? ` (${x.symbol})` : ""}`
                        )
                        .join(", ")
                    : "Keine Angabe"}
                </strong>
              </div>

              <div className="detail">
                <label>Sprache(n)</label>
                <strong>
                  {selected.languages
                    ? Object.values(selected.languages).join(", ")
                    : "Keine Angabe"}
                </strong>
              </div>

              <div className="detail">
                <label>Region</label>
                <strong>
                  {selected.region}
                  {selected.subregion
                    ? ` · ${selected.subregion}`
                    : ""}
                </strong>
              </div>

              <button
                className="primary"
                onClick={() => {
                  setSelected(null);
                  setQuery("");

                  globeRef.current?.pointOfView(
                    { lat: 20, lng: 0, altitude: 2.5 },
                    1000
                  );
                }}
              >
                Auswahl löschen
              </button>
            </div>
          ) : (
            <div className="hint">
              Wähle ein Land in der Suche oder klicke auf einen
              Punkt des Globus. Hauptstadt, Einwohnerzahl,
              Währung und Sprachen erscheinen hier.
            </div>
          )}
        </aside>
      </section>

      {error && (
        <div className="error">
          Fehler: {error} — Bitte Internetverbindung prüfen.
        </div>
      )}

      <footer>
        OUR EARTH <span>·</span> Daten: World Countries Dataset
        <span>·</span> Bevölkerungsdaten: Weltbank
        <span>·</span> 3D-Globus
      </footer>
    </main>
  );
}
