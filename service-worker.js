"use strict";

/** Opens the relevant VVC page when a browser notification is selected. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) return existing.focus().then(() => existing.navigate(target));
      return self.clients.openWindow(target);
    })
  );
});
