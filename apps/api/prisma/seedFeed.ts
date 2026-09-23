import { processImage, processSquareImage } from '../src/lib/images.js';
import { prisma } from '../src/lib/prisma.js';
import { buildKey, publicUrl, saveObject } from '../src/lib/storage.js';
import { renderSampleCourtPhoto } from './seedImages.js';

/**
 * Example posts, so the feed has something to show before the arena has any real
 * photos. Idempotent: if the feed already has anything, this does nothing.
 */

interface SeedPost {
  /** E-mail of the author, resolved against the users the seed created. */
  authorEmail: string;
  /** Index into the venue list; the CT the photo is tagged with. */
  venueIndex: number | null;
  caption: string | null;
  /** How many other members liked it. */
  likes: number;
  /** Hours ago, so the feed is not all posted at the same minute. */
  hoursAgo: number;
}

const SEED_POSTS: SeedPost[] = [
  {
    authorEmail: 'ana.aluna@futcheck.local',
    venueIndex: 0,
    caption: 'Primeiro treino da semana. Sol e areia, do jeito que tem que ser.',
    likes: 6,
    hoursAgo: 3,
  },
  {
    authorEmail: 'diego.aluno@futcheck.local',
    venueIndex: 2,
    caption: 'Dayuse de terça no Vila Madalena. Quadra cheia!',
    likes: 4,
    hoursAgo: 9,
  },
  {
    authorEmail: 'isabela.dayuse@futcheck.local',
    venueIndex: 1,
    caption: 'Sábado de manhã no Ibirapuera 🌤️',
    likes: 9,
    hoursAgo: 26,
  },
  {
    authorEmail: 'bruno.aluno@futcheck.local',
    venueIndex: 0,
    caption: null,
    likes: 2,
    hoursAgo: 33,
  },
  {
    authorEmail: 'camila.aluna@futcheck.local',
    venueIndex: 3,
    caption: 'Domingo à tarde na Zona Norte. Vale cada viagem.',
    likes: 7,
    hoursAgo: 50,
  },
  {
    authorEmail: 'joao.dayuse@futcheck.local',
    venueIndex: 0,
    caption: 'Treino da noite sob os refletores.',
    likes: 5,
    hoursAgo: 72,
  },
];

export async function seedFeed(userIds: Map<string, string>, venueIds: string[]): Promise<number> {
  const existing = await prisma.post.count();
  if (existing > 0) return 0;

  const everyone = [...userIds.values()];
  let created = 0;

  for (const [index, post] of SEED_POSTS.entries()) {
    const authorId = userIds.get(post.authorEmail);
    if (!authorId) continue;

    const photo = await renderSampleCourtPhoto(index);

    // Through the same pipeline a real upload takes, so the seeded rows are not
    // a special case the app has never actually handled.
    const [image, thumbnail] = await Promise.all([
      processImage(photo, { maxSize: 1440 }),
      processSquareImage(photo, 480),
    ]);

    const imageKey = buildKey('posts');
    const thumbnailKey = buildKey('posts');

    await Promise.all([saveObject(imageKey, image.data), saveObject(thumbnailKey, thumbnail.data)]);

    const createdAt = new Date(Date.now() - post.hoursAgo * 3_600_000);

    const row = await prisma.post.create({
      data: {
        authorId,
        venueId: post.venueIndex === null ? null : (venueIds[post.venueIndex] ?? null),
        imageKey,
        thumbnailKey,
        width: image.width,
        height: image.height,
        caption: post.caption,
        createdAt,
      },
      select: { id: true },
    });

    // Likes from other members, never from the author.
    const likers = everyone.filter((id) => id !== authorId).slice(0, post.likes);

    if (likers.length > 0) {
      await prisma.postLike.createMany({
        data: likers.map((userId) => ({ postId: row.id, userId, createdAt })),
        skipDuplicates: true,
      });
    }

    created += 1;
  }

  return created;
}

/** The public URL of a stored key, for logging what the seed produced. */
export { publicUrl };
