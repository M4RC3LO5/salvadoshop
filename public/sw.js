// Service worker minimo: permite instalar o app. Nao guarda nada em cache,
// entao o site e o painel sempre mostram dados atualizados.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))
self.addEventListener("fetch", () => {})
