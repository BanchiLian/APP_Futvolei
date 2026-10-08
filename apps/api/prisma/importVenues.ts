/**
 * Imports real training centres from OpenStreetMap.
 *
 *   npm run db:import-venues -w @futcheck/api
 *
 * The rows in `data/venues-sp-osm.json` were collected from the Overpass API,
 * filtered to sand arenas in the state of São Paulo and completed with reverse
 * geocoding. Nothing in them is invented: a field OpenStreetMap does not know is
 * left empty, because these are real businesses and a wrong phone number or a
 * made-up address is worse than none.
 *
 * Idempotent: a row is matched by its OpenStreetMap element id, so running this
 * twice updates instead of duplicating. Re-running after a fresh collection is
 * how the list stays current.
 *
 * Data © OpenStreetMap contributors, ODbL. The attribution is shown in the app
 * on the CTs screen, which the licence requires.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '../src/lib/prisma.js';

interface ImportedVenue {
  /** OpenStreetMap element, e.g. `node/6747186942`. */
  externalId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  instagram: string | null;
  /** The raw OSM `sport` tag, kept for the description only. */
  sports: string | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, 'data', 'venues-sp-osm.json');

/** Turns the OSM sport tag into something a person would read. */
function describe(sports: string | null): string | null {
  if (!sports) return null;

  const names: Record<string, string> = {
    footvolley: 'futevôlei',
    futevolei: 'futevôlei',
    futvoley: 'futevôlei',
    beachvolleyball: 'vôlei de praia',
    beach_volleyball: 'vôlei de praia',
    beachsoccer: 'futebol de areia',
    beach_soccer: 'futebol de areia',
    beachtennis: 'beach tennis',
    beach_tennis: 'beach tennis',
  };

  const listed = [
    ...new Set(
      sports
        .split(';')
        .map((sport) => names[sport.trim().toLowerCase()])
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  if (listed.length === 0) return null;

  const human =
    listed.length === 1
      ? listed[0]
      : `${listed.slice(0, -1).join(', ')} e ${listed[listed.length - 1] ?? ''}`;

  return `Quadra de areia para ${human}. Informação do OpenStreetMap, ainda não confirmada pelo CT.`;
}

export async function importOsmVenues(): Promise<{ created: number; updated: number }> {
  const rows = JSON.parse(await readFile(DATA, 'utf8')) as ImportedVenue[];

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const fields = {
      name: row.name,
      description: describe(row.sports),
      address: row.address,
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
      phone: row.phone,
      instagram: row.instagram,
    };

    const existing = await prisma.venue.findUnique({
      where: { source_externalId: { source: 'OSM', externalId: row.externalId } },
      select: { id: true },
    });

    await prisma.venue.upsert({
      where: { source_externalId: { source: 'OSM', externalId: row.externalId } },
      create: { ...fields, source: 'OSM', externalId: row.externalId },
      // `isActive` is left alone on purpose: if someone deactivated a CT here,
      // a re-import must not bring it back.
      update: fields,
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated };
}

// Run directly, not when imported by the seed.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  importOsmVenues()
    .then(({ created, updated }) => {
      console.log(`✔ ${created} CTs criados, ${updated} atualizados (fonte: OpenStreetMap)`);
    })
    .catch((error: unknown) => {
      console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
