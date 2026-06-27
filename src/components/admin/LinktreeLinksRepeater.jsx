import { useState } from 'preact/hooks';

function createEmptyLink() {
  return { text: '', url: '' };
}

function LinkFields({ item, index, onChange }) {
  return (
    <div class="linktree-link-fields">
      <div class="form-group">
        <input
          id={`link-text-${index}`}
          type="text"
          value={item.text}
          placeholder="Texto del enlace"
          onInput={(event) => onChange(index, 'text', event.target.value)}
        />
      </div>
      <div class="form-group">
        <input
          id={`link-url-${index}`}
          type="url"
          value={item.url}
          placeholder="https://..."
          onInput={(event) => onChange(index, 'url', event.target.value)}
        />
      </div>
    </div>
  );
}

export default function LinktreeLinksRepeater({ items, onChange }) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const updateItem = (index, field, value) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addItem = () => {
    onChange([...items, createEmptyLink()]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const reorderItems = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex === null || toIndex === null) {
      return;
    }

    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  const handleDragStart = (event, index) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (index) => {
    reorderItems(draggedIndex, index);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div class="form-section">
      <div class="linktree-links-header">
        <h2>Enlaces</h2>
        <button
          type="button"
          class="btn-icon"
          onClick={addItem}
          title="Añadir enlace"
          aria-label="Añadir enlace"
        >
          +
        </button>
      </div>

      {items.length === 0 ? (
        <p class="empty">No hay enlaces todavía. Pulsa + para crear el primero.</p>
      ) : (
        <div class="linktree-links-list">
          {items.map((item, index) => (
            <div
              key={`link-${index}`}
              class={`linktree-link-item ${draggedIndex === index ? 'is-dragging' : ''}`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
            >
              <button
                type="button"
                class="linktree-link-drag"
                draggable
                title="Arrastrar para reordenar"
                aria-label="Arrastrar para reordenar"
                onDragStart={(event) => handleDragStart(event, index)}
                onDragEnd={handleDragEnd}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="9" cy="5" r="1"></circle>
                  <circle cx="9" cy="12" r="1"></circle>
                  <circle cx="9" cy="19" r="1"></circle>
                  <circle cx="15" cy="5" r="1"></circle>
                  <circle cx="15" cy="12" r="1"></circle>
                  <circle cx="15" cy="19" r="1"></circle>
                </svg>
              </button>

              <LinkFields item={item} index={index} onChange={updateItem} />

              <button
                type="button"
                class="btn-icon-delete"
                title="Eliminar enlace"
                aria-label="Eliminar enlace"
                onClick={() => removeItem(index)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
