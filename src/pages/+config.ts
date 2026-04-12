import type { Config } from "vike/types";
import vikeReact from "vike-react/config";

export default {
    title: "Meet2Meet",
    description: "Meet2Meet — 드래그 기반 시간 선택",
    extends: [vikeReact],
    server: "+server.ts",
} satisfies Config;
