// Where the app is running: the real app on docledger.site, or the public demo
// on demo.docledger.site (same build, the server picks the demo database by host).

export const SITE_URL = 'https://docledger.site';
export const DEMO_URL = 'https://demo.docledger.site';
export const BOOKING_URL = 'https://cal.com/saaqib-khan-fai1vo/15min';
export const CONTACT_EMAIL = 'saaqib@docledger.site';

export function isDemoHost() {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.VITE_DEMO === '1') return true;
  const h = window.location.hostname.toLowerCase();
  return h === 'demo.docledger.site' || h === 'demo-preview.docledger.site';
}

// Sample documents shipped in client/public/samples, one per built in type.
export const SAMPLE_DOCS = [
  { file: 'shipping-bill', label: 'Shipping line bill', type: 'shipping' },
  { file: 'fuel-receipt', label: 'Fuel receipt', type: 'adnoc' },
  { file: 'shop-receipt', label: 'Shop receipt', type: 'general' },
];
