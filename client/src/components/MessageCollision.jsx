import { useEffect, useState } from 'react';

export default function MessageCollision({ events }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    fetch('/api/messages/history', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((data) => setHistory(data.history ?? []))
      .catch(() => {});
  }, []);

  const impacts = events.filter((evt) => evt.type === 'asteroid').slice(-5).reverse();
  return (
    <section className="collision-feed">
      <h2>Recent Impacts</h2>
      <ul>
        {impacts.map((evt) => {
          const physics = evt.payload?.physics;
          const sentiment = evt.payload?.metadata?.sentiment?.label ?? physics?.visual?.sentiment;
          return (
            <li key={`${evt.payload?.messageId}-${physics?.chunkIndex}`}>
              <span>{new Date(evt.ts).toLocaleTimeString()}</span>
              <span>Chunk {physics?.chunkIndex}</span>
              <span>{sentiment ? sentiment.toUpperCase() : 'NEUTRAL'}</span>
              <span>Energy {formatEnergy(physics?.impact?.energy)}</span>
            </li>
          );
        })}
      </ul>
      {history.length > 0 && (
        <div className="history-meta">
          <strong>Archives:</strong> {history.length} secured transmissions
        </div>
      )}
    </section>
  );
}

function formatEnergy(value) {
  if (!value) return '0 J';
  if (value > 1e12) return `${(value / 1e12).toFixed(2)} TJ`;
  if (value > 1e9) return `${(value / 1e9).toFixed(2)} GJ`;
  if (value > 1e6) return `${(value / 1e6).toFixed(2)} MJ`;
  return `${Math.round(value)} J`;
}
