import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)", "../pages/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/react-vite",
  addons: [],
};

export default config;
