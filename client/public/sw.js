const CACHE_NAME = 'juego-v1';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service worker instalado');
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service worker activado');
});

// Interceptar peticiones (modo básico offline)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('No hay conexión a internet');
    })
  );
});
