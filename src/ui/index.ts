import { loadData } from '../data/load';
import { bootstrap } from './main';
import './style.css';

void bootstrap(document.getElementById('app')!, loadData);
