import { JEV_TOOL_DEFINITION, createJevToolHandler } from './tool-host.mjs';
import { createMcpHttpHandler } from './mcp-http.mjs';

// A real service must supply trusted OAuth verification and atomic approved-call reservations.
export function createJevMcpEndpoint({ verifyAccessToken, consumeApprovedCall,
  allowedOrigins, resourceUrl, authorizationServer, apiKey, fetchImpl } = {}) {
  return createMcpHttpHandler({
    toolDefinition: JEV_TOOL_DEFINITION, verifyAccessToken, consumeApprovedCall,
    allowedOrigins, resourceUrl, authorizationServer,
    makeToolHandler: ({ allowOneLiveCall }) => createJevToolHandler({
      allowOneLiveCall, apiKey, ...(fetchImpl ? { fetchImpl } : {}),
    }),
  });
}
