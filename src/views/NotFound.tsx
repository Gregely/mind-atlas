import { href } from '../lib/router';

export function NotFound() {
  return (
    <div className="page page-narrow notfound">
      <p className="eyebrow">Uncatalogued location</p>
      <h1 className="display">Nothing is filed here</h1>
      <p>
        <a href={href('/')}>Return to the catalogue</a>
      </p>
    </div>
  );
}
