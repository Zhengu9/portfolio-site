import { handleMediaRequest } from "../_shared/api.js";

export const onRequest = ({ request, env, params }) => {
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  return handleMediaRequest(request, env, segments.filter(Boolean).join("/"));
};
