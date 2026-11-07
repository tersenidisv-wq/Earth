
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

const fmt = (n: number | null | undefined) => {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return "Keine Angabe";
  }

  return new Intl.NumberFormat("de-DE").format(n);
};

export default function EarthExplorer() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selected, setSelected] = useState<Country | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);

  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  // Länder laden
  useEffect(() => {
    const controller = new AbortController();

    async function loadCountries() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "https://raw.githubusercontent.com/mledoze/countries/master/countries.json",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Länderdaten konnten nicht geladen werden.");
        }

        const rawData = await response.json();

const data: Country[] = rawData.map((c: any) => ({
  ...c,
  population: Number(c.population ?? 0),
}));

        const validCountries = data.filter(
          (c) =>
            c.name?.common &&
            c.name?.official &&
            c.cca3 &&
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
      countries.filter(
        (c) =>
          c.name.common.toLowerCase().includes(query.toLowerCase()) ||
          c.name.official.toLowerCase().includes(query.toLowerCase())
      ),
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
                (c) => c.name.common === p.name
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
                {selected.flags?.svg && (
                  <img
                    src={selected.flags.svg}
                    alt={selected.name.common}
                  />
                )}

                <div>
                  <h3>{selected.name.common}</h3>
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
        <span>·</span> 3D-Globus
      </footer>
    </main>
  );
}
