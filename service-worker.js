// service-worker.js для PWA «Портрет личности» v1.0.8
const CACHE_NAME = 'personality-portrait-v1.0.8';
const CACHE_PREFIX = 'personality-portrait';

// Критически важные файлы для кэширования (адаптируйте пути под своё размещение)
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/service-worker.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Установка: кэшируем файлы
self.addEventListener('install', event => {
  console.log('[SW] Установка', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Кэширование файлов');
      return Promise.allSettled(
        FILES_TO_CACHE.map(url => {
          return cache.add(url).catch(err => console.error('[SW] Ошибка кэширования', url, err));
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Активация: очистка старых кэшей
self.addEventListener('activate', event => {
  console.log('[SW] Активация', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME && name.startsWith(CACHE_PREFIX)) {
            console.log('[SW] Удаляем старый кэш:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: стратегия stale-while-revalidate
self.addEventListener('fetch', event => {
  const { request } = event;

  // Пропускаем не-GET запросы
  if (request.method !== 'GET') return;

  // Для навигационных запросов (главная страница)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Пробуем сеть
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            return networkResponse;
          }
        } catch (error) {
          console.log('[SW] Нет интернета, ищем в кэше');
        }
        // Ищем в кэше
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        // Абсолютная заглушка
        return new Response('Страница не найдена в офлайн-режиме', { status: 404 });
      })()
    );
    return;
  }

  // Для остальных ресурсов: сначала кэш, потом сеть с фоновым обновлением
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Фоновое обновление
        fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      // Нет в кэше - идём в сеть
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Если ресурс не загрузился и нет в кэше
        if (request.url.match(/\.(png|jpg|jpeg|svg|ico)$/)) {
          return new Response('', { status: 404 });
        }
        return new Response('Ресурс не найден в офлайн-режиме', { status: 404 });
      }
    })()
  );
});