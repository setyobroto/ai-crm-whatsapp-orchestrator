'use strict';

// Satu sumber kode untuk gateway dan node n8n. Harga/fitur belum diberikan owner.
// Isi nama resmi, priceIDR, billingUnit, features; lalu ubah approved menjadi true.
// Jangan gunakan angka contoh sebagai harga produksi. Tambahkan tenant lain di sini.
const catalogs = {
  'world-english': {
    version: 'world-english-catalog-v1',
    offers: {
      basic_english: {
        approved: false, name: '', priceIDR: null, billingUnit: '', features: [],
        cta: 'Mau kami bantu langkah pendaftarannya?'
      },
      premium_english: {
        approved: false, name: '', priceIDR: null, billingUnit: '', features: [],
        cta: 'Mau kami bantu langkah pendaftarannya?'
      },
      cara_daftar: {
        text: 'Boleh kami bantu langkah pendaftaran untuk program yang Kakak pilih?'
      },
      tanya_jadwal: {
        text: 'Waktu belajar seperti apa yang cocok dengan aktivitas Kakak?'
      },
      tidak_ada: {
        text: 'Bagian mana yang ingin Kakak pastikan sebelum menentukan pilihan?'
      }
    }
  }
};

const OFFER_KEYS = ['basic_english', 'premium_english', 'cara_daftar', 'tanya_jadwal', 'tidak_ada'];
const OBJECTIONS = ['harga', 'jadwal', 'program', 'siap_daftar', 'belum_diketahui'];
const FIELDS = ['message_prefix', 'offer_key', 'summary', 'objection'];
const MAX_MESSAGE = 1200;
const MAX_PREFIX = 360;

function normalizeText(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC')
      .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
      .replace(/\s+/g, ' ').trim()
    : '';
}

function hasUrl(text) {
  return /(?:https?:|www\.|mailto:|wa\.me\b|t\.me\b|bit\.ly\b)|\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\b|\/)/i.test(text);
}

function unsafePrefix(text) {
  if (!text || text.length > MAX_PREFIX || hasUrl(text)) return true;
  // Prefix hanya empati, bukan tempat semua angka/fakta komersial.
  if (/[\p{N}\p{Sc}%\u{1f4af}]/u.test(text)) return true;
  if (/\b(?:rp|idr|rupiah|ribu|ribuan|juta|jutaan|miliar|milyar|triliun|persen|diskon|promo|promosi|subsidi|gratis|potongan|dp|cicilan|angsuran|cashback)\b/i.test(text)) return true;
  if (/\b(?:dijamin|jaminan|garansi|pasti|deadline|tenggat|kuota|slot|antrean|antrian)\b|hanya hari ini|kesempatan terakhir|kursi terakhir|tanpa risiko|selalu berhasil|lebih murah|paling murah|ganti jadwal kapan saja/i.test(text)) return true;
  // Satu CTA diberikan oleh katalog; tidak menumpuk pertanyaan AI.
  if (/[?？]/u.test(text)) return true;
  return false;
}

function parseDraft(value) {
  try {
    if (typeof value === 'string') {
      if (value.length > 10000) return null;
      value = JSON.parse(value.trim()); // JSON ketat: code fence ditolak.
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (keys.length !== FIELDS.length || !FIELDS.every(k => Object.prototype.hasOwnProperty.call(value, k) && typeof value[k] === 'string')) return null;
    if (!OBJECTIONS.includes(value.objection) || !OFFER_KEYS.includes(value.offer_key)) return null;
    if (value.summary.length > 1200) return null;
    return value;
  } catch { return null; }
}

function fallbackPrefix(objection) {
  const prefixes = {
    harga: 'Halo Kak. Mari cocokkan kebutuhan belajar dengan anggaran yang Kakak pertimbangkan.',
    jadwal: 'Halo Kak. Rencana belajar perlu sesuai dengan aktivitas Kakak.',
    program: 'Halo Kak. Mari tentukan pilihan berdasarkan tujuan belajar Kakak.',
    siap_daftar: 'Halo Kak. Kami siap membantu langkah pendaftarannya.',
    belum_diketahui: 'Halo Kak. Kami siap membantu informasi yang masih dibutuhkan untuk menentukan pilihan.'
  };
  return prefixes[objection] || prefixes.belum_diketahui;
}

function safeOffer(objection) {
  if (objection === 'siap_daftar') return 'cara_daftar';
  if (objection === 'jadwal') return 'tanya_jadwal';
  return 'tidak_ada';
}

function offerMatches(key, objection) {
  if (key === 'basic_english' || key === 'premium_english') return ['harga', 'program'].includes(objection);
  if (key === 'cara_daftar') return objection === 'siap_daftar';
  if (key === 'tanya_jadwal') return ['jadwal', 'belum_diketahui'].includes(objection);
  return key === 'tidak_ada';
}

function renderOffer(catalog, key, objection) {
  const offer = catalog.offers[key];
  if (!offer) return null;
  if (key === 'tidak_ada') {
    // CTA bantuan tetap spesifik saat penawaran berbayar belum disahkan.
    if (objection === 'harga') return 'Bagian informasi biayanya yang ingin Kakak perjelas?';
    if (objection === 'program') return 'Bagian programnya yang ingin Kakak perjelas?';
  }
  if (key !== 'basic_english' && key !== 'premium_english') return offer.text;
  const name = normalizeText(offer.name);
  const unit = normalizeText(offer.billingUnit);
  const cta = normalizeText(offer.cta);
  const features = Array.isArray(offer.features) ? offer.features.map(normalizeText) : [];
  if (offer.approved !== true || !name || name.length > 80 || !unit || unit.length > 40
      || !Number.isSafeInteger(offer.priceIDR) || offer.priceIDR <= 0
      || !features.length || features.length > 5 || features.some(x => !x || x.length > 120)
      || !cta || cta.length > 160) return null;
  const price = String(offer.priceIDR).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${name}. Rincian program: ${features.join('; ')}.\nBiaya resmi: Rp${price} ${unit}.\n${cta}`;
}

function validateDraft(candidate, value) {
  const tenant = typeof candidate?.tenant === 'string' ? candidate.tenant : '';
  const catalog = Object.prototype.hasOwnProperty.call(catalogs, tenant) ? catalogs[tenant] : null;
  if (!catalog) {
    throw Object.assign(new Error('Katalog tenant belum dikonfigurasi.'), { code: 'CATALOG_TENANT_UNKNOWN', status: 409 });
  }
  const parsed = parseDraft(value);
  // Saat schema rusak, jangan mempercayai klasifikasi sebagian keluaran.
  const objection = parsed?.objection || 'belum_diketahui';
  const reasons = [];
  let prefix = normalizeText(parsed?.message_prefix);
  let key = parsed?.offer_key || safeOffer(objection);
  if (!parsed) reasons.push('INVALID_AI_SCHEMA');
  if (unsafePrefix(prefix)) reasons.push('UNSAFE_PREFIX');
  if (reasons.length) {
    prefix = fallbackPrefix(objection);
    key = safeOffer(objection);
  }
  if (!offerMatches(key, objection)) {
    reasons.push('OFFER_CONTEXT_MISMATCH');
    prefix = fallbackPrefix(objection);
    key = safeOffer(objection);
  }
  let tail = renderOffer(catalog, key, objection);
  if (!tail) {
    reasons.push('OFFER_NOT_APPROVED_OR_INCOMPLETE');
    prefix = fallbackPrefix(objection);
    key = safeOffer(objection);
    tail = renderOffer(catalog, key, objection);
  }
  let message = `${prefix}\n\n${tail}`;
  if (message.length > MAX_MESSAGE) {
    reasons.push('MESSAGE_TOO_LONG');
    prefix = fallbackPrefix(objection);
    key = safeOffer(objection);
    message = `${prefix}\n\n${renderOffer(catalog, key, objection)}`;
  }
  return {
    message_prefix: prefix,
    offer_key: key,
    message,
    summary: normalizeText(parsed?.summary).slice(0, 600),
    objection,
    fallbackUsed: reasons.length > 0,
    fallbackReason: [...new Set(reasons)].join(','),
    catalog_version: catalog.version
  };
}

module.exports = { validateDraft, catalogs };
