import type { PageContextClient } from "vike/types";

export async function onPageTransitionStart(pageContext: Partial<PageContextClient>) {
  document.body.classList.add("page-transition");
}
