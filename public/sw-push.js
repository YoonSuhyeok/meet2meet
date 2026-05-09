/* global self */

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = typeof payload.title === "string" && payload.title.trim() !== ""
    ? payload.title
    : "Meet2Meet";

  const body = typeof payload.body === "string"
    ? payload.body
    : "You have a new meeting update.";

  const tag = typeof payload.tag === "string" ? payload.tag : "meet2meet-notification";

  const data = payload && typeof payload.data === "object" && payload.data !== null
    ? payload.data
    : {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data,
      renotify: true,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.url === "string" &&
    event.notification.data.url.trim() !== ""
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
