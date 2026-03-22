/**
 * UGent MedBot — Service Worker
 * Handles incoming web push notifications and notification click events.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: "UGent Daily Fact",
      body: event.data.text(),
      icon: "/icons/icon-192x192.png",
    };
  }

  const { title, body, icon, badge, tag, data: notifData } = data;

  event.waitUntil(
    self.registration.showNotification(title ?? "UGent MedBot", {
      body: body ?? "",
      icon: icon ?? "/icons/icon-192x192.png",
      badge: badge ?? "/icons/badge-72x72.png",
      tag: tag ?? "ugent-push",
      data: notifData ?? { url: "/dashboard" },
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if already open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
