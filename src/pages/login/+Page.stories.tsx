import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoginPage } from "./+Page";

const meta: Meta<typeof LoginPage> = {
  title: "Pages/Login",
  component: LoginPage,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

export const Default: StoryObj<typeof LoginPage> = {};

export const WithError: StoryObj<typeof LoginPage> = {
  args: {
    error: "auth_failed",
  },
};

export const WithServerError: StoryObj<typeof LoginPage> = {
  args: {
    error: "server_error",
  },
};

export const Mobile: StoryObj<typeof LoginPage> = {
  globals: {
    viewport: {
      value: "mobile",
      isRotated: false,
    },
  },
};
