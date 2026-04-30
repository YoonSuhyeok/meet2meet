import logoUrl from "@/src/shared/assets/logo.svg";

export function Head() {
    return (
        <>
            <link rel="icon" href={logoUrl} />
            <link rel="manifest" href="/manifest.webmanifest" />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
            />
            <meta name="theme-color" content="#1a1a2e" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            <meta name="apple-mobile-web-app-title" content="Meet2Meet" />
        </>
    );
}
