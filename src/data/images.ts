const DD = 'https://ddragon.leagueoflegends.com';

/** URL path the app uses (served from public/img/ by Vite). */
export const championIconPath = (id: string) => `/img/champion/${id}.png`;
export const itemIconPath = (id: string) => `/img/item/${id}.png`;

export type ImageJob = { url: string; dest: string };

/** Download list for the fetch script: Data Dragon url -> file under public/. */
export function imageJobs(patch: string, championIds: string[], itemIds: string[]): ImageJob[] {
  const job = (kind: 'champion' | 'item', id: string): ImageJob => ({
    url: `${DD}/cdn/${patch}/img/${kind}/${id}.png`,
    dest: `public/img/${kind}/${id}.png`,
  });
  return [...championIds.map((id) => job('champion', id)), ...itemIds.map((id) => job('item', id))];
}
