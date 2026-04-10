import { APP_ASSETS, type AssetRecord } from "./_generated-assets.ts";

const FUNCTION_NAME = "portal";
const DEFAULT_HEADERS = {
  "referrer-policy": "same-origin",
} as const;

const LOADER_SCRIPT = `window.addEventListener('load',()=>{fetch('./api').then(r=>r.json()).then(d=>{const f=document.createElement('iframe');f.sandbox.add('allow-same-origin','allow-scripts','allow-forms','allow-popups','allow-top-navigation','allow-presentation');const w=f.contentWindow;f.style.width='100%';f.style.height='100%';f.style.border='none';document.body.innerHTML='';document.body.appendChild(f);w.document.open();w.document.write(d.html);w.document.close()}).catch(e=>{document.body.innerHTML='<pre>Error: '+e.message+'</pre>'})})`;

const LOADER_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gestion Operativa TI</title><script>${LOADER_SCRIPT}</script></head><body></body></html>`;

function decodeBody(bodyBase64: string): Uint8Array {
  const text = atob(bodyBase64);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
}

function buildAssetResponse(asset: AssetRecord, method: string): Response {
  const headers = new Headers(DEFAULT_HEADERS);
  
  // For HTML, wrap it in JSON to bypass sandbox
  if (asset.contentType.includes("text/html")) {
    const htmlContent = new TextDecoder().decode(decodeBody(asset.bodyBase64));
    const jsonResponse = JSON.stringify({ html: htmlContent });
    const jsonBytes = new TextEncoder().encode(jsonResponse);
    
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", asset.cacheControl);
    return new Response(jsonBytes, { status: 200, headers });
  }
  
  headers.set("Content-Type", asset.contentType);
  headers.set("Cache-Control", asset.cacheControl);
  headers.set("X-Portal-Asset", "true");

  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  return new Response(decodeBody(asset.bodyBase64), { status: 200, headers });
}

function normalizePath(url: URL): { path: string; redirectTo: string | null } {
  const variants = [
    `/functions/v1/${FUNCTION_NAME}`,
    `/${FUNCTION_NAME}`,
  ];

  for (const basePath of variants) {
    if (!url.pathname.startsWith(basePath)) {
      continue;
    }

    const suffix = url.pathname.slice(basePath.length);
    if (suffix === "") {
      return {
        path: "/",
        redirectTo: `${url.origin}${url.pathname}/${url.search}`,
      };
    }

    return {
      path: suffix.startsWith("/") ? suffix : `/${suffix}`,
      redirectTo: null,
    };
  }

  return { path: "/", redirectTo: null };
}

Deno.serve((request) => {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: DEFAULT_HEADERS,
    });
  }

  const url = new URL(request.url);
  const normalized = normalizePath(url);

  if (normalized.redirectTo) {
    return Response.redirect(normalized.redirectTo, 308);
  }

  let path = normalized.path;
  if (path === "/index.html") {
    path = "/";
  }

  // Serve the loader HTML at root
  if (path === "/") {
    const headers = new Headers(DEFAULT_HEADERS);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "no-cache");
    return new Response(LOADER_HTML, { status: 200, headers });
  }

  // Serve the actual content as JSON at /api
  if (path === "/api") {
    const asset = APP_ASSETS["/"];
    if (asset) {
      const headers = new Headers(DEFAULT_HEADERS);
      headers.set("Content-Type", "application/json");
      headers.set("Cache-Control", "no-cache");
      
      const htmlContent = new TextDecoder().decode(decodeBody(asset.bodyBase64));
      const jsonData = JSON.stringify({ html: htmlContent });
      return new Response(jsonData, { status: 200, headers });
    }
  }

  let asset = APP_ASSETS[path];
  if (!asset && !path.includes(".")) {
    asset = APP_ASSETS["/"];
  }

  if (asset) {
    return buildAssetResponse(asset, method);
  }

  return new Response("Not found", {
    status: 404,
    headers: DEFAULT_HEADERS,
  });
});
