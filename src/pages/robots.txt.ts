import type { APIRoute } from 'astro';
import { absolute } from '../lib/data';

export const GET: APIRoute = () => {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${absolute('/sitemap.xml')}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
