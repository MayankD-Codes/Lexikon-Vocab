import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://lexikon-vocab.vercel.app";

const setMeta = (selector: string, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const [, name] = selector.match(/\[(?:name|property)="([^"]+)"\]/) ?? [];
    if (selector.includes("property=")) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const setCanonical = (href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

interface SEOProps {
  title: string;
  description: string;
  /** Override canonical path (defaults to current path) */
  path?: string;
  /** noindex this page */
  noindex?: boolean;
}

/**
 * SEO — sets <title>, meta description, canonical, robots, and OG/Twitter
 * variants for the current page. Use once per page.
 */
const SEO = ({ title, description, path, noindex }: SEOProps) => {
  const location = useLocation();
  useEffect(() => {
    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[name="robots"]', "content", noindex ? "noindex, nofollow" : "index, follow");
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    const canonical = `${SITE_URL}${path ?? location.pathname}`;
    setCanonical(canonical);
    setMeta('meta[property="og:url"]', "content", canonical);
  }, [title, description, path, noindex, location.pathname]);
  return null;
};

export default SEO;
