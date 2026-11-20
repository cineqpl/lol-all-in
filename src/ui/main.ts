import type { GameData } from '../data/load';
import { computeMatchup } from '../model/matchup';
import { h } from './dom';
import { createPanel } from './panel';
import { renderResults } from './results';

function showError(root: HTMLElement, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  root.replaceChildren(
    h('p', { 'data-testid': 'error', class: 'error' }, `Something went wrong: ${message}`),
  );
}

export function mount(root: HTMLElement, data: GameData): void {
  const results = h('section', { class: 'results' });
  const update = () => {
    try {
      renderResults(results, computeMatchup(you.getSide(), enemy.getSide()), data);
    } catch (err) {
      showError(results, err);
    }
  };
  const you = createPanel(data, 'you', 'You', update);
  const enemy = createPanel(data, 'enemy', 'Enemy', update);
  root.replaceChildren(h('div', { class: 'panels' }, you.el, enemy.el), results);
  update();
}

export async function bootstrap(root: HTMLElement, load: () => Promise<GameData>): Promise<void> {
  try {
    mount(root, await load());
  } catch (err) {
    showError(root, err);
  }
}
