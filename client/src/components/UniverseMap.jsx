import { useEffect, useState } from 'react';

export default function UniverseMap() {
  const [galaxies, setGalaxies] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = window.localStorage.getItem('token');
    if (!token) return;
    fetch('/api/galaxies', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((data) => setGalaxies(data.galaxies || []))
      .catch((err) => setError(err?.toString() || 'Failed to load galaxies'));
  }, []);

  const handleSelect = (galaxyId) => {
    window.localStorage.setItem('galaxyId', galaxyId);
    window.location.reload();
  };

  return (
    <section className="universe-map">
      <h2>Galaxies</h2>
      {error && <p className="error-text">{error}</p>}
      <ul>
        {galaxies.map((galaxy) => (
          <li key={galaxy.galaxy_id}>
            <button type="button" onClick={() => handleSelect(galaxy.galaxy_id)}>
              {galaxy.region} - {galaxy.user_count} users
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
