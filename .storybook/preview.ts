import "../src/app/styles/global.css";

import type { Preview } from "storybook";

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: "Mobile", styles: { width: "375px", height: "812px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" } },
      },
    },
  },
};

export default preview;
