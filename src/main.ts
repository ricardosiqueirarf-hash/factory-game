import './styles.css';
import { FactoryThreeApp } from './three/FactoryThreeApp';

const root = document.getElementById('game');

if (!root) {
  throw new Error('Elemento #game nao encontrado.');
}

const app = new FactoryThreeApp(root);
app.start();
