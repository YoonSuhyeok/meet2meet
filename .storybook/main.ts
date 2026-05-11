import type { StorybookConfig } from "@storybook/react-vite";
import type { PluginOption } from "vite";

function shouldExcludePlugin(name: string) {
    return (
        name.startsWith("vite-plugin-pwa") ||
        name === "vike" ||
        name.startsWith("vike:") ||
        name.includes("cloudflare") ||
        name.startsWith("vite:react")
    );
}

function filterAppOnlyPlugins(plugins: PluginOption[] = []): PluginOption[] {
    return plugins.flatMap((plugin) => {
        if (!plugin) {
            return [];
        }

        if (Array.isArray(plugin)) {
            return filterAppOnlyPlugins(plugin);
        }

        if (typeof plugin === "boolean") {
            return plugin ? [plugin] : [];
        }

        if (typeof plugin === "object" && "name" in plugin) {
            return shouldExcludePlugin(plugin.name) ? [] : [plugin];
        }

        return [plugin];
    });
}

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(ts|tsx)"],
    framework: "@storybook/react-vite",
    addons: [],
    async viteFinal(config) {
        return {
            ...config,
            plugins: filterAppOnlyPlugins(config.plugins ?? []),
        };
    },
};

export default config;
