export function imageSrc(image) {
  if (typeof image === 'string') return image;
  return image?.url || image?.src || '';
}

export function imageAlt(image) {
  if (!image || typeof image === 'string') return '';
  return image.alt || '';
}

export function stepIndex(index, delta, length) {
  if (length <= 0) return 0;
  return ((index + delta) % length + length) % length;
}

const SWIPE_THRESHOLD = 48;

class GalleryManager {
  constructor(container) {
    this.container = container;
    this.images = JSON.parse(container.getAttribute('data-gallery') || '[]');
    this.currentIndex = 0;
    this.suppressClick = false;
    this.imageElement = container.querySelector('.gallery-current-image');
    this.openButton = container.querySelector('.gallery-open');
    this.prevButton = container.querySelector('.gallery-nav-prev');
    this.nextButton = container.querySelector('.gallery-nav-next');
    this.init();
  }

  init() {
    if (this.images.length <= 1) {
      this.prevButton.style.display = 'none';
      this.nextButton.style.display = 'none';
    }

    this.prevButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.prev();
    });

    this.nextButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.next();
    });

    const viewer = this.container.querySelector('.gallery-viewer');
    viewer.addEventListener('click', (event) => {
      if (event.target.closest('.gallery-nav')) return;
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      this.openLightbox();
    });

    this.container.addEventListener('keydown', (event) => {
      if (this.images.length <= 1) return;
      if (document.getElementById('lightbox')?.classList.contains('active')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.prev();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.next();
      }
    });

    this.bindSwipe();
  }

  bindSwipe() {
    const viewer = this.container.querySelector('.gallery-viewer');
    if (!viewer || this.images.length <= 1) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pointerId = 0;

    viewer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('.gallery-nav')) return;
      tracking = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
    });

    viewer.addEventListener('pointermove', (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      try {
        viewer.setPointerCapture(event.pointerId);
      } catch {
        // El pointer ya no está activo.
      }
    });

    viewer.addEventListener('pointerup', (event) => {
      if (!tracking || event.pointerId !== pointerId) return;
      tracking = false;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      this.suppressClick = true;
      if (dx < 0) this.next();
      else this.prev();
      window.setTimeout(() => {
        this.suppressClick = false;
      }, 0);
    });

    viewer.addEventListener('pointercancel', () => {
      tracking = false;
    });
  }

  prev() {
    this.currentIndex = stepIndex(this.currentIndex, -1, this.images.length);
    this.updateImage();
  }

  next() {
    this.currentIndex = stepIndex(this.currentIndex, 1, this.images.length);
    this.updateImage();
  }

  updateImage({ immediate = false } = {}) {
    const token = (this.updateToken = (this.updateToken || 0) + 1);
    const image = this.images[this.currentIndex];
    const newSrc = imageSrc(image);
    const newAlt = imageAlt(image);

    const apply = () => {
      if (token !== this.updateToken) return;
      this.imageElement.src = newSrc;
      this.imageElement.alt = newAlt;
      if (this.openButton) {
        this.openButton.setAttribute('aria-label', newAlt ? `Ver en grande: ${newAlt}` : 'Ver imagen en grande');
      }
      this.imageElement.style.opacity = '1';
    };

    if (immediate) {
      apply();
      return;
    }

    const faded = new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    const loaded = new Promise((resolve) => {
      const preload = new Image();
      preload.onload = resolve;
      preload.onerror = resolve;
      preload.src = newSrc;
    });

    this.imageElement.style.opacity = '0';
    Promise.all([faded, loaded]).then(apply);
  }

  openLightbox() {
    Lightbox.getInstance().open(this.images, this.currentIndex, (index) => {
      this.currentIndex = index;
      this.updateImage({ immediate: true });
    });
  }
}

class Lightbox {
  static instance = null;

  static getInstance() {
    if (!Lightbox.instance) {
      Lightbox.instance = new Lightbox();
    }
    return Lightbox.instance;
  }

  constructor() {
    this.images = [];
    this.currentIndex = 0;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.isDragging = false;
    this.didDrag = false;
    this.didSwipe = false;
    this.gestureOnImage = false;
    this.swipeTracking = false;
    this.isPinching = false;
    this.minScale = 1;
    this.maxScale = 4;

    this.lightbox = document.getElementById('lightbox');
    this.contentElement = document.getElementById('lightbox-content');
    this.imageElement = document.getElementById('lightbox-image');
    this.closeButton = document.getElementById('lightbox-close');
    this.prevButton = document.getElementById('lightbox-prev');
    this.nextButton = document.getElementById('lightbox-next');

    this.onWheel = this.onWheel.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.keyHandler = this.keyHandler.bind(this);

    this.init();
  }

  init() {
    this.closeButton.addEventListener('click', () => this.close());

    this.lightbox.addEventListener('click', (event) => {
      const startedOnImage = this.gestureOnImage;
      this.gestureOnImage = false;
      if (this.didSwipe) {
        this.didSwipe = false;
        return;
      }
      if (startedOnImage || event.target.closest('.lightbox-image')) return;
      if (event.target !== this.lightbox && event.target !== this.contentElement) return;
      if (this.didDrag) return;
      if (this.isZoomed()) this.resetZoom();
      else this.close();
    });

    this.prevButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.prev();
    });

    this.nextButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.next();
    });

    this.contentElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.contentElement.addEventListener('pointerdown', this.onPointerDown);
    this.contentElement.addEventListener('pointermove', this.onPointerMove);
    this.contentElement.addEventListener('pointerup', this.onPointerUp);
    this.contentElement.addEventListener('pointercancel', this.onPointerUp);
    this.contentElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.contentElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.contentElement.addEventListener('touchend', this.onTouchEnd);
    this.contentElement.addEventListener('touchcancel', this.onTouchEnd);
  }

  isZoomed() {
    return this.scale > 1.01;
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  getContentCenter() {
    const rect = this.contentElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  clientToLocal(clientX, clientY) {
    const center = this.getContentCenter();
    return {
      x: clientX - center.x,
      y: clientY - center.y,
    };
  }

  touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  touchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  applyTransform() {
    this.imageElement.style.transform =
      `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
  }

  updateZoomState() {
    this.imageElement.classList.toggle('is-zoomed', this.isZoomed());
    this.imageElement.classList.toggle('is-zoomable', !this.isZoomed());
  }

  clampPan() {
    const baseWidth = this.imageElement.offsetWidth;
    const baseHeight = this.imageElement.offsetHeight;
    const scaledWidth = baseWidth * this.scale;
    const scaledHeight = baseHeight * this.scale;
    const maxX = Math.max(0, (scaledWidth - this.contentElement.clientWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - this.contentElement.clientHeight) / 2);
    this.translateX = this.clamp(this.translateX, -maxX, maxX);
    this.translateY = this.clamp(this.translateY, -maxY, maxY);
  }

  zoomAt(localX, localY, newScale) {
    newScale = this.clamp(newScale, this.minScale, this.maxScale);
    if (Math.abs(newScale - this.scale) < 0.001) return;

    const ratio = newScale / this.scale;
    this.translateX = localX - ratio * (localX - this.translateX);
    this.translateY = localY - ratio * (localY - this.translateY);
    this.scale = newScale;

    if (!this.isZoomed()) {
      this.resetZoom();
      return;
    }

    this.clampPan();
    this.applyTransform();
    this.updateZoomState();
  }

  resetZoom() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.imageElement.style.transform = '';
    this.imageElement.classList.remove('is-zoomed', 'is-dragging');
    this.imageElement.classList.add('is-zoomable');
  }

  onWheel(event) {
    if (!this.lightbox.classList.contains('active')) return;
    event.preventDefault();

    const local = this.clientToLocal(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.12 : 0.88;
    this.zoomAt(local.x, local.y, this.scale * factor);
  }

  onPointerDown(event) {
    if (!this.lightbox.classList.contains('active')) return;
    if (event.target.closest('button')) return;

    this.gestureOnImage = event.target.closest('.lightbox-image') !== null;

    if (this.isZoomed()) {
      if (event.pointerType === 'touch' && this.isPinching) return;
      this.isDragging = true;
      this.didDrag = false;
      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;
      this.dragStartTranslateX = this.translateX;
      this.dragStartTranslateY = this.translateY;
      this.imageElement.classList.add('is-dragging');
      try {
        this.contentElement.setPointerCapture(event.pointerId);
      } catch {
        // El pointer ya no está activo.
      }
      return;
    }

    if (this.images.length <= 1) return;
    this.swipeTracking = true;
    this.swipePointerId = event.pointerId;
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;
  }

  onPointerMove(event) {
    if (this.isDragging) {
      const dx = event.clientX - this.dragStartX;
      const dy = event.clientY - this.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.didDrag = true;
      this.translateX = this.dragStartTranslateX + dx;
      this.translateY = this.dragStartTranslateY + dy;
      this.clampPan();
      this.applyTransform();
      return;
    }

    if (!this.swipeTracking || event.pointerId !== this.swipePointerId) return;
    const dx = event.clientX - this.swipeStartX;
    const dy = event.clientY - this.swipeStartY;
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
    try {
      this.contentElement.setPointerCapture(event.pointerId);
    } catch {
      // El pointer ya no está activo.
    }
  }

  onPointerUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.imageElement.classList.remove('is-dragging');
      return;
    }

    if (!this.swipeTracking || event.pointerId !== this.swipePointerId) return;
    this.swipeTracking = false;
    if (event.type === 'pointercancel') return;
    const dx = event.clientX - this.swipeStartX;
    const dy = event.clientY - this.swipeStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    this.didSwipe = true;
    if (dx < 0) this.next();
    else this.prev();
    window.setTimeout(() => {
      this.didSwipe = false;
    }, 0);
  }

  onTouchStart(event) {
    if (!this.lightbox.classList.contains('active')) return;
    if (event.touches.length !== 2) return;

    this.isPinching = true;
    this.isDragging = false;
    this.swipeTracking = false;
    this.pinchStartDistance = this.touchDistance(event.touches);
    this.pinchStartScale = this.scale;
    this.pinchStartTranslateX = this.translateX;
    this.pinchStartTranslateY = this.translateY;

    const center = this.touchCenter(event.touches);
    const local = this.clientToLocal(center.x, center.y);
    this.pinchCenterX = local.x;
    this.pinchCenterY = local.y;
  }

  onTouchMove(event) {
    if (!this.isPinching || event.touches.length !== 2) return;
    event.preventDefault();

    const distance = this.touchDistance(event.touches);
    if (this.pinchStartDistance === 0) return;

    const newScale = this.clamp(
      this.pinchStartScale * (distance / this.pinchStartDistance),
      this.minScale,
      this.maxScale,
    );

    if (!this.isZoomed() && newScale <= 1) {
      this.resetZoom();
      return;
    }

    const ratio = newScale / this.pinchStartScale;
    this.scale = newScale;
    this.translateX = this.pinchCenterX - ratio * (this.pinchCenterX - this.pinchStartTranslateX);
    this.translateY = this.pinchCenterY - ratio * (this.pinchCenterY - this.pinchStartTranslateY);

    if (!this.isZoomed()) {
      this.resetZoom();
      return;
    }

    this.clampPan();
    this.applyTransform();
    this.updateZoomState();
  }

  onTouchEnd(event) {
    if (event.touches.length < 2) {
      this.isPinching = false;
      this.pinchStartDistance = 0;
    }
  }

  keyHandler(event) {
    if (!this.lightbox.classList.contains('active')) return;
    if (event.key === 'Escape') {
      if (this.isZoomed()) this.resetZoom();
      else this.close();
      return;
    }
    if (this.isZoomed()) return;
    if (event.key === 'ArrowLeft') this.prev();
    if (event.key === 'ArrowRight') this.next();
  }

  open(images, startIndex = 0, onIndexChange = null) {
    this.images = images;
    this.currentIndex = startIndex;
    this.onIndexChange = onIndexChange;
    this.resetZoom();
    this.didDrag = false;
    this.didSwipe = false;
    this.gestureOnImage = false;
    this.swipeTracking = false;
    this.isPinching = false;
    this.lightbox.classList.add('active');
    this.lightbox.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', this.keyHandler);
    this.updateImage();
  }

  close() {
    this.lightbox.classList.remove('active');
    this.lightbox.setAttribute('hidden', '');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', this.keyHandler);
    this.resetZoom();
    this.isDragging = false;
    this.swipeTracking = false;
    this.isPinching = false;
  }

  goTo(index) {
    if (index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetZoom();
    this.updateImage();
    this.onIndexChange?.(this.currentIndex);
  }

  prev() {
    this.goTo(stepIndex(this.currentIndex, -1, this.images.length));
  }

  next() {
    this.goTo(stepIndex(this.currentIndex, 1, this.images.length));
  }

  updateImage() {
    const image = this.images[this.currentIndex];
    this.imageElement.src = imageSrc(image);
    this.imageElement.alt = imageAlt(image);

    const single = this.images.length <= 1;
    this.prevButton.style.display = single ? 'none' : 'flex';
    this.nextButton.style.display = single ? 'none' : 'flex';
    this.updateZoomState();
  }
}

let started = false;

export function initMediaGallery() {
  if (started) return;
  started = true;

  document.querySelectorAll('.gallery-container[data-gallery]').forEach((gallery) => {
    new GalleryManager(gallery);
  });

  const section = document.querySelector('.content-section[data-all-images]');
  if (!section) return;

  const allImages = JSON.parse(section.getAttribute('data-all-images') || '[]');
  if (allImages.length === 0) return;

  section.querySelectorAll('.content-lightbox-image').forEach((img) => {
    img.addEventListener('click', () => {
      const src = img.getAttribute('data-lightbox-src') || img.src;
      const index = allImages.indexOf(src);
      Lightbox.getInstance().open(allImages, index >= 0 ? index : 0);
    });
  });
}
