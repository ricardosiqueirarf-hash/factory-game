import './styles.css';
import { FactoryThreeAppV2 } from './three/FactoryThreeAppV2';

const root = document.getElementById('game');

if (!root) {
  throw new Error('Elemento #game nao encontrado.');
}

const app = new FactoryThreeAppV2(root);
app.start();
