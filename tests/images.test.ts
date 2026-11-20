import { describe, expect, test } from 'vitest';
import { championIconPath, imageJobs, itemIconPath } from '../src/data/images';

describe('image paths', () => {
  test('champion and item icon paths', () => {
    expect(championIconPath('Annie')).toBe('/img/champion/Annie.png');
    expect(itemIconPath('3089')).toBe('/img/item/3089.png');
  });

  test('imageJobs maps each id to its Data Dragon url and a file under public/', () => {
    const jobs = imageJobs('16.23.1', ['Annie'], ['3089']);
    expect(jobs).toEqual([
      {
        url: 'https://ddragon.leagueoflegends.com/cdn/16.23.1/img/champion/Annie.png',
        dest: 'public/img/champion/Annie.png',
      },
      {
        url: 'https://ddragon.leagueoflegends.com/cdn/16.23.1/img/item/3089.png',
        dest: 'public/img/item/3089.png',
      },
    ]);
  });
});
