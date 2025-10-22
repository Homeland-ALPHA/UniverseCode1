import { EventEmitter } from 'node:events';
import { v4 as uuid } from 'uuid';
import { galaxiesCollection, listGalaxies, upsertGalaxy } from '../models/galaxies.js';

const SYNC_CHANNEL = 'universe:galaxy-sync';

export class GalaxyManager extends EventEmitter {
  constructor({ mongo, redis }) {
    super();
    this.mongo = mongo;
    this.redis = redis;
    this.cache = new Map();
    this.publisher = redis.publisher ?? redis.general;
    this.subscriber = redis.subscriber ?? redis.general;
    this.io = null;
    this.started = false;
  }

  async bootstrapNamespaces(io) {
    this.io = io;
    const galaxies = await listGalaxies();
    if (!galaxies.length) {
      await this.seedDefaultGalaxies();
    }
    const fresh = await listGalaxies();
    fresh.forEach((galaxy) => {
      this.cache.set(galaxy.galaxy_id, galaxy);
      this.emit('galaxy:update', galaxy);
    });
  }

  async startSync() {
    if (this.started || !this.subscriber) return;
    this.started = true;
    await this.subscriber.subscribe(SYNC_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== SYNC_CHANNEL) return;
      try {
        const payload = JSON.parse(message.toString());
        this.handleSyncEvent(payload);
      } catch (err) {
        console.error('[UniverseCode] Failed to parse galaxy sync message', err);
      }
    });
  }

  handleSyncEvent(event) {
    if (!event) return;
    if (event.type === 'galaxy-upsert' && event.galaxy) {
      this.cache.set(event.galaxy.galaxy_id, event.galaxy);
      this.emit('galaxy:update', event.galaxy);
    }
    if (event.type === 'galaxy-user-count' && event.galaxy_id) {
      const cached = this.cache.get(event.galaxy_id);
      if (cached) {
        cached.user_count = event.user_count;
        this.emit('galaxy:update', cached);
      }
    }
  }

  async seedDefaultGalaxies(count = 3) {
    const promises = Array.from({ length: count }).map((_, idx) => {
      const galaxy_id = uuid();
      const seed = Math.random().toString(36).slice(2, 10);
      const galaxy = {
        galaxy_id,
        node_url: `wss://galaxy-${idx}.universe.local`,
        user_count: 0,
        region: ['us-east', 'us-west', 'eu-central'][idx % 3],
        nonce: seed,
        created_at: new Date()
      };
      return upsertGalaxy(galaxy).then(() => {
        this.publisher?.publish(SYNC_CHANNEL, JSON.stringify({ type: 'galaxy-upsert', galaxy }));
      });
    });
    await Promise.all(promises);
  }

  async assignGalaxyForUser() {
    let galaxies = Array.from(this.cache.values());
    if (!galaxies.length) {
      galaxies = await listGalaxies();
      galaxies.forEach((g) => this.cache.set(g.galaxy_id, g));
    }
    const selected = galaxies.sort((a, b) => a.user_count - b.user_count)[0];

    const coords = this.generateCoords(selected);
    const orbitZone = this.computeOrbitZone(coords);

    await galaxiesCollection().updateOne(
      { galaxy_id: selected.galaxy_id },
      { $inc: { user_count: 1 } }
    );
    selected.user_count += 1;
    this.publisher?.publish(
      SYNC_CHANNEL,
      JSON.stringify({
        type: 'galaxy-user-count',
        galaxy_id: selected.galaxy_id,
        user_count: selected.user_count
      })
    );

    this.emit('galaxy:update', selected);

    return {
      galaxy_id: selected.galaxy_id,
      node_url: selected.node_url,
      region: selected.region,
      nonce: selected.nonce,
      coords,
      mass: coords.magnitude * 5e21,
      orbit_zone: orbitZone
    };
  }

  getGalaxy(galaxyId) {
    return this.cache.get(galaxyId);
  }

  getGalaxyNonce(galaxyId) {
    return this.cache.get(galaxyId)?.nonce;
  }

  generateCoords(galaxy) {
    const seed = galaxy.nonce || Math.random().toString(36).slice(2, 10);
    const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const radius = 5_000 + (hash % 2_000);
    const inclination = (hash % 180) * (Math.PI / 180);
    const azimuth = ((hash / 3) % 360) * (Math.PI / 180);
    const x = radius * Math.cos(azimuth) * Math.sin(inclination);
    const y = radius * Math.sin(azimuth) * Math.sin(inclination);
    const z = radius * Math.cos(inclination);
    return { x, y, z, magnitude: radius };
  }

  computeOrbitZone(coords) {
    if (coords.magnitude < 6_000) return 'inner';
    if (coords.magnitude < 6_800) return 'mid';
    return 'outer';
  }
}
