// VeilChat PWA Service Worker
const CACHE_NAME = 'veilchat-v2';
const STATIC_CACHE = 'veilchat-static-v2';
const API_CACHE = 'veilchat-api-v2';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/js/llmService.js',
  '/js/voiceService.js',
  '/js/imageService.js',
  '/js/contextservice.js',
  '/js/azureTTSService.js',
  '/js/mcpClient.js',
  '/pages/user-settings.html',
  '/pages/persona.html',
  '/manifest.json',
  // External CDN resources (cache for offline use)
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  '/api/mcp/call'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip service worker for external API calls (let them go directly)
  if (isExternalAPI(request)) {
    return; // Don't intercept external API calls
  }
  
  // Handle critical assets (CSS/JS) with stale-while-revalidate strategy
  if (isCriticalAsset(request)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache => {
        return cache.match(request).then(cachedResponse => {
          const fetchPromise = fetch(request).then(networkResponse => {
            // Update cache in background if successful
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // If network fails and we have cache, return cached version
            return cachedResponse;
          });
          
          // Return cached response immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
  
  // Handle non-critical static assets (images, fonts) with cache-first strategy
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then(response => {
              // Cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
        .catch(() => {
          // Return offline fallback for HTML pages
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        })
    );
    return;
  }
  
  // Handle API calls with network-first strategy (cache for offline)
  if (isApiRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.status === 200 && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(API_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if offline
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return offline response for API calls
              return new Response(
                JSON.stringify({
                  error: 'Offline - cached response not available',
                  offline: true
                }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }
  
  // For all other requests, try network first, then cache
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Helper functions
function isCriticalAsset(request) {
  return request.method === 'GET' && (
    request.url.includes('.css') ||
    request.url.includes('.js') ||
    request.url.includes('.html')
  );
}

function isStaticAsset(request) {
  return request.method === 'GET' && (
    request.url.includes('.png') ||
    request.url.includes('.jpg') ||
    request.url.includes('.ico') ||
    request.url.includes('.json') ||
    request.url.includes('cdnjs.cloudflare.com') ||
    request.url.includes('cdn.jsdelivr.net')
  );
}

function isExternalAPI(request) {
  return (
    request.url.includes('openai.com') ||
    request.url.includes('anthropic.com') ||
    request.url.includes('googleapis.com') ||
    request.url.includes('speech.microsoft.com') ||
    request.url.includes('litellm') ||
    request.url.includes('localhost:3001') ||
    request.url.includes('localhost:7860')
  );
}

function isApiRequest(request) {
  return API_CACHE_PATTERNS.some(pattern => 
    request.url.includes(pattern)
  );
}

// Background sync for failed requests (when online again)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(
      // Handle any queued requests when back online
      handleBackgroundSync()
    );
  }
});

// Push notification support (future feature)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New message in VeilChat',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'veilchat-notification',
      actions: [
        {
          action: 'open',
          title: 'Open Chat'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'VeilChat', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

async function handleBackgroundSync() {
  // Implementation for handling queued requests
  // This would integrate with your app's offline queue system
  console.log('Service Worker: Handling background sync');
}

// Log service worker lifecycle
console.log('Service Worker: Script loaded');