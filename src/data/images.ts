const DD = 'https://ddragon.leagueoflegends.com';

/** URL path the app uses (served from public/img/ by Vite). */
export const championIconPath = (id: string) => `/img/champion/${id}.png`;
export const itemIconPath = (id: string) => `/img/item/${id}.png`;
export const spellIconPath = (file: string) => `/img/spell/${file}`;

export type ImageJob = { url: string; dest: string };

/** Download list for the fetch script: Data Dragon url -> file under public/. */
export function imageJobs(
  patch: string,
  championIds: string[],
  itemIds: string[],
  spellFiles: string[] = [],
): ImageJob[] {
  const job = (kind: 'champion' | 'item' | 'spell', file: string): ImageJob => ({
    url: `${DD}/cdn/${patch}/img/${kind}/${file}`,
    dest: `public/img/${kind}/${file}`,
  });
  return [
    ...championIds.map((id) => job('champion', `${id}.png`)),
    ...itemIds.map((id) => job('item', `${id}.png`)),
    ...spellFiles.map((file) => job('spell', file)),
  ];
}
