import { useState } from 'react';
import { Search, X } from 'lucide-react';
import styles from './FilterBar.module.css';

export default function FilterBar({
  categories, resources,
  filters,
  onToggleCategory, onToggleResource,
  onSearch, onClear,
}) {
  const hasActiveFilters =
    filters.categories.size > 0 ||
    filters.resources.size > 0 ||
    (filters.search && filters.search.trim());

  return (
    <div className={styles.bar}>
      {/* Category pills */}
      {categories.length > 0 && (
        <div className={styles.pillGroup}>
          {categories.map(cat => (
            <button
              key={cat}
              className={[styles.pill, filters.categories.has(cat) && styles.active].filter(Boolean).join(' ')}
              onClick={() => onToggleCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Resource pills */}
      {resources.length > 0 && (
        <div className={styles.pillGroup}>
          {resources.map(res => (
            <button
              key={res}
              className={[styles.pill, styles.resource, filters.resources.has(res) && styles.active].filter(Boolean).join(' ')}
              onClick={() => onToggleResource(res)}
            >
              {res}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className={styles.searchWrap}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.search}
          placeholder="Search events…"
          value={filters.search || ''}
          onChange={e => onSearch(e.target.value)}
        />
        {filters.search && (
          <button className={styles.clearSearch} onClick={() => onSearch('')} aria-label="Clear search">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button className={styles.clearAll} onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
