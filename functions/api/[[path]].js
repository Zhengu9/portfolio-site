import { handleApiRequest } from "../_shared/api.js";

export const onRequest = ({ request, env }) => handleApiRequest(request, env);
