import './styles.css';
import { BusinessIdleApp } from './business/BusinessIdleApp';

const root = document.getElementById('game');

if (root) {
  new BusinessIdleApp(root);
}
