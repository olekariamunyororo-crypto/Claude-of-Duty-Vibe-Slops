import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// StrictMode intentionally omitted — double-invoked effects would register
// every fixed tick twice (doubled physics, audio, listeners).
createRoot(document.getElementById('root')!).render(<App />);
