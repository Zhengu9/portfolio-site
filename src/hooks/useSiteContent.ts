import { useEffect, useState } from "react";
import { getSiteContent } from "../api/client";
import type { SiteContent } from "../types/content";

type ContentState =
  | { status: "loading" }
  | { status: "ready"; content: SiteContent }
  | { status: "error"; message: string };

export function useSiteContent(): ContentState {
  const [state, setState] = useState<ContentState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    getSiteContent(controller.signal)
      .then((content) => setState({ status: "ready", content }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "暂时无法加载内容",
        });
      });

    return () => controller.abort();
  }, []);

  return state;
}
