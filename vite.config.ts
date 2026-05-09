import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    server: {
        host: "0.0.0.0",
        // Allow Cloudflare Quick Tunnel domains for real-device HTTPS testing.
        allowedHosts: [".trycloudflare.com"],
    },
    plugins: [
        cloudflare({ viteEnvironment: { name: "ssr" } }),
        tailwindcss(),
        vike(),
        react(),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: false,
            includeAssets: ["pwa-icon.svg", "pwa-icon-192.png", "pwa-icon-512.png"],
            manifest: {
                name: "Meet2Meet",
                short_name: "Meet2Meet",
                description: "드래그 기반 시간 선택으로 모임 일정을 빠르게 조율합니다.",
                theme_color: "#1a1a2e",
                background_color: "#1a1a2e",
                display: "standalone",
                start_url: "/",
                scope: "/",
                icons: [
                    {
                        src: "/pwa-icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-icon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any maskable",
                    },
                ],
            },
            workbox: {
                importScripts: ["/sw-push.js"],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                navigateFallback: "/offline.html",
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) => url.pathname.startsWith("/api/meetings"),
                        handler: "NetworkFirst",
                        method: "GET",
                        options: {
                            cacheName: "meeting-api-read-cache",
                            networkTimeoutSeconds: 3,
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 5,
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "google-fonts-stylesheets",
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-webfonts",
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
        dedupe: ["react", "react-dom"],
    },
    ssr: {
        optimizeDeps: {
            include: [
                "react",
                "react-dom/server.edge",
                "clsx",
                "tailwind-merge",
            ],
        },
    },
});
