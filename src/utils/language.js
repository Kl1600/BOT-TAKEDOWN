import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';
import dbService from '../database/dbProxy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJsonTranslation(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(content);
}

const frTranslations = readJsonTranslation(join(__dirname, '../translations/fr.json'));
const enTranslations = readJsonTranslation(join(__dirname, '../translations/en.json'));

const translations = {
  fr: frTranslations,
  en: enTranslations
};

const TRANSLATION_GLOSSARY = {
  frToEn: [
    [/acceptation du règlement/gi, 'acceptance of the rules'],
    [/acceptation du reglement/gi, 'acceptance of the rules'],
    [/règlement/gi, 'rules'],
    [/reglement/gi, 'rules'],
    [/règles/gi, 'rules'],
    [/regles/gi, 'rules'],
    [/annonce/gi, 'announcement'],
    [/annonces/gi, 'announcements'],
    [/évènement/gi, 'event'],
    [/évènements/gi, 'events'],
    [/evenement/gi, 'event'],
    [/evenements/gi, 'events'],
    [/patch[- ]note/gi, 'patch note'],
    [/patch[- ]notes/gi, 'patch notes'],
    [/tournoi/gi, 'tournament'],
    [/tournois/gi, 'tournaments'],
    [/chasseur/gi, 'hunter'],
    [/chasseurs/gi, 'hunters']
  ],
  enToFr: [
    [/acceptance of the rules/gi, 'acceptation du règlement'],
    [/rules/gi, 'règlement'],
    [/announcement/gi, 'annonce'],
    [/announcements/gi, 'annonces'],
    [/events/gi, 'évènements'],
    [/event/gi, 'évènement'],
    [/patch notes/gi, 'patch notes'],
    [/patch note/gi, 'patch note'],
    [/tournaments/gi, 'tournois'],
    [/tournament/gi, 'tournoi'],
    [/hunters/gi, 'chasseurs'],
    [/hunter/gi, 'chasseur']
  ]
};

async function fetchFreshMember(member) {
  if (!member?.guild || !member?.id) return member;

  return member.guild.members.fetch(member.id, { force: true }).catch(async () => {
    try {
      return await member.guild.members.fetch(member.id).catch(() => member);
    } catch {
      return member;
    }
  });
}

function applyGlossary(text, fromLang, toLang) {
  const rules = TRANSLATION_GLOSSARY[`${fromLang}To${toLang}`];
  if (!rules || !text) return text;

  let result = text;
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export async function getLanguage(member) {
  if (!member) return config.welcome.defaultLang || 'fr';

  const freshMember = await fetchFreshMember(member);

  if (freshMember.roles && freshMember.roles.cache) {
    if (freshMember.roles.cache.has(config.roles.fr)) {
      return 'fr';
    }
    if (freshMember.roles.cache.has(config.roles.en)) {
      return 'en';
    }
  }

  if (member.forceLanguage === 'fr' || member.forceLanguage === 'en') {
    return member.forceLanguage;
  }

  const userId = freshMember.id;
  try {
    const dbLang = await dbService.getUserLanguage(userId);
    if (dbLang === 'fr' || dbLang === 'en') {
      return dbLang;
    }
  } catch {
    // ignore database errors
  }

  return config.welcome.defaultLang || 'fr';
}

export async function isEnglishOnly(member) {
  if (!member) return false;

  const freshMember = await fetchFreshMember(member);
  const roles = freshMember?.roles?.cache;
  if (!roles) return false;

  return roles.has(config.roles.en) && !roles.has(config.roles.fr);
}

export async function getFaqAnswerLanguage(member) {
  if (!member) return config.welcome.defaultLang || 'fr';

  const freshMember = await fetchFreshMember(member);
  const roles = freshMember?.roles?.cache;
  if (roles) {
    if (roles.has(config.roles.fr)) return 'fr';
    if (roles.has(config.roles.en) && !roles.has(config.roles.fr)) return 'en';
  }

  if (member.forceLanguage === 'fr' || member.forceLanguage === 'en') {
    return member.forceLanguage;
  }

  return config.welcome.defaultLang || 'fr';
}

export function t(lang, key, replacements = {}) {
  const dictionary = translations[lang] || translations.fr;

  const value = key.split('.').reduce((acc, part) => {
    return acc && acc[part] !== undefined ? acc[part] : null;
  }, dictionary);

  if (value === null || typeof value !== 'string') {
    if (lang !== 'fr') {
      return t('fr', key, replacements);
    }
    return key;
  }

  let resolved = value;
  for (const [placeholder, val] of Object.entries(replacements)) {
    resolved = resolved.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(val));
  }

  return resolved;
}

function applyTranslationFixes(sourceText, translatedText, fromLang, toLang) {
  if (!sourceText || !translatedText) {
    return translatedText;
  }

  let result = applyGlossary(translatedText, fromLang, toLang);

  if (fromLang === 'fr' && toLang === 'en') {
    result = result
      .replace(/acceptance of payment/gi, 'acceptance of the rules')
      .replace(/acceptance of the rule/gi, 'acceptance of the rules')
      .replace(/acceptance of the regulation/gi, 'acceptance of the rules')
      .replace(/\bpayment\b/gi, 'rules')
      .replace(/\bregulation\b/gi, 'rules');
  }

  return result;
}

function preserveSourceCasing(sourceText, translatedText) {
  if (!sourceText || !translatedText) {
    return translatedText;
  }

  const source = sourceText.trim();
  const translated = translatedText.trim();

  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return translated.toUpperCase();
  }

  if (source === source.toLowerCase()) {
    return translated.toLowerCase();
  }

  const sourceTitleCase = source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
  if (source === sourceTitleCase) {
    return translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
  }

  return translated;
}

export async function translateText(text, fromLang = 'fr', toLang = 'en') {
  if (!text) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) return text;

    const data = await response.json();
    if (data && data[0]) {
      const translated = data[0].map(item => item[0]).join('');
      return preserveSourceCasing(text, applyTranslationFixes(text, translated, fromLang, toLang));
    }
    return preserveSourceCasing(text, applyTranslationFixes(text, text, fromLang, toLang));
  } catch {
    return preserveSourceCasing(text, applyTranslationFixes(text, text, fromLang, toLang));
  }
}

export async function detectTextLanguage(text) {
  if (!text || !String(text).trim()) return null;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const source = data?.[2];
    if (typeof source === 'string' && source.trim()) {
      return source.trim().toLowerCase();
    }
  } catch {
    // ignore detection failures
  }

  return null;
}

export default {
  getLanguage,
  t,
  translateText,
  detectTextLanguage
};
