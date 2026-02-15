/**
 * Generic LRU (Least Recently Used) cache.
 * On capacity overflow, the least-recently accessed entry is evicted.
 */
export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly map = new Map<K, V>();

  constructor(capacity: number) {
    if (capacity < 1) throw new Error('LRUCache capacity must be >= 1');
    this.capacity = capacity;
  }

  /** Get a value and promote it to most-recently used. */
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    // Re-insert to move to end (most-recent)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /** Set a value, evicting the oldest entry if at capacity. */
  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Evict oldest (first entry in Map iteration order)
      const oldest = this.map.keys().next().value!;
      this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  /** Remove an entry by key. Returns true if the key existed. */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
