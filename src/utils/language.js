import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';
import dbService from '../database/dbProxy.js';
import * as logger from './logger.js';

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

const TRANSLATION_TIMEOUT_MS = 10_000;
const TRANSLATION_MAX_ATTEMPTS = 3;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableTranslationStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchTranslation(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= TRANSLATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS)
      });

      if (response.ok) return response;

      const responseError = new Error(`Le service de traduction a répondu avec le statut HTTP ${response.status}.`);
      if (!isRetryableTranslationStatus(response.status)) {
        responseError.retryable = false;
        throw responseError;
      }
      lastError = responseError;
    } catch (err) {
      if (err?.retryable === false) throw err;
      lastError = err;
    }

    if (attempt < TRANSLATION_MAX_ATTEMPTS) {
      await wait(attempt * 1000);
    }
  }

  throw lastError || new Error('Le service de traduction est indisponible.');
}

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

function getLanguageFromRoles(roles) {
  if (!roles) return null;
  if (roles.has(config.roles.fr)) return 'fr';
  if (roles.has(config.roles.en)) return 'en';
  return null;
}

async function resolveCurrentRoles(member) {
  if (!member) return null;

  const freshMember = await fetchFreshMember(member);
  if (freshMember?.roles?.cache) {
    return freshMember.roles.cache;
  }

  return member?.roles?.cache || null;
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
  const freshLanguage = getLanguageFromRoles(freshMember?.roles?.cache);
  if (freshLanguage) return freshLanguage;

  const cachedLanguage = getLanguageFromRoles(member?.roles?.cache);
  if (cachedLanguage) return cachedLanguage;

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

  const roles = await resolveCurrentRoles(member);
  if (!roles) return false;

  return roles.has(config.roles.en) && !roles.has(config.roles.fr);
}

export async function hasFrenchRole(member) {
  if (!member) return false;

  const roles = await resolveCurrentRoles(member);
  if (!roles) return false;

  return roles.has(config.roles.fr);
}

export async function getFaqAnswerLanguage(member) {
  if (!member) return config.welcome.defaultLang || 'fr';

  const roles = await resolveCurrentRoles(member);
  if (roles) {
    if (roles.has(config.roles.fr)) return 'fr';
    if (roles.has(config.roles.en) && !roles.has(config.roles.fr)) return 'en';
  }

  const cachedLanguage = getLanguageFromRoles(member?.roles?.cache);
  if (cachedLanguage) return cachedLanguage;

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

function normalizeDetectionText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreLanguage(text, language) {
  const normalized = normalizeDetectionText(text);
  if (!normalized) return 0;

  const tokens = normalized.split(' ');
  const tokenSet = new Set(tokens);

  const englishHints = new Set([
    'a', 'an', 'and', 'are', 'as', 'be', 'by', 'can', 'do', 'for', 'from',
    'hello', 'hi', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
    'please', 'so', 'that', 'the', 'this', 'to', 'we', 'what', 'when', 'where',
    'who', 'why', 'will', 'with', 'you', 'your', 'everyone', 'good', 'morning',
    'evening', 'thanks', 'thank', 'have', 'has', 'not', 'no', 'yes'
  ]);

  const frenchHints = new Set([
    'au', 'aux', 'avec', 'ce', 'ces', 'cet', 'cette', 'de', 'des', 'du',
    'dans', 'est', 'et', 'fait', 'faites', 'bonjour', 'bonsoir', 'je', 'la',
    'le', 'les', 'leur', 'leurs', 'mais', 'nous', 'par', 'pas', 'pour', 'que',
    'qui', 'sur', 'tu', 'vous', 'une', 'un', 'vos', 'etre', 'tous',
    'tout', 'merci', 'salut', 'oui', 'non', 'comment', 'traduire'
  ]);

  const hints = language === 'en' ? englishHints : frenchHints;
  let score = 0;

  for (const token of tokenSet) {
    if (hints.has(token)) score += 1;
  }

  if (language === 'fr') {
    if (/[àâçéèêëîïôùûüÿœæ]/i.test(text)) score += 2;
    if (/\b(?:le|la|les|des|du|une|un|que|qui|pour|avec|sans|dans|sur|pas|est|sont)\b/i.test(text)) {
      score += 1;
    }
  } else if (language === 'en') {
    if (/\b(?:the|and|you|your|with|for|that|this|is|are|hello|thanks|thank|everyone)\b/i.test(text)) {
      score += 1;
    }
  }

  return score;
}

function guessTextLanguage(text) {
  const frScore = scoreLanguage(text, 'fr');
  const enScore = scoreLanguage(text, 'en');

  if (frScore === 0 && enScore === 0) {
    return null;
  }

  if (enScore > frScore) {
    return 'en';
  }

  if (frScore > enScore) {
    return 'fr';
  }

  return null;
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
    const response = await fetchTranslation(url);

    const data = await response.json();
    if (data && data[0]) {
      const translated = data[0].map(item => item[0]).join('');
      return preserveSourceCasing(text, applyTranslationFixes(text, translated, fromLang, toLang));
    }
    throw new Error('Le service de traduction a renvoyé une réponse invalide.');
  } catch (err) {
    logger.error(`Échec de la traduction ${fromLang} vers ${toLang} après ${TRANSLATION_MAX_ATTEMPTS} tentatives:`, err);
    throw new Error('Le service de traduction est temporairement indisponible.', { cause: err });
  }
}

export async function detectTextLanguage(text) {
  if (!text || !String(text).trim()) return null;

  const heuristic = guessTextLanguage(text);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetchTranslation(url);
    if (!response.ok) return heuristic;

    const data = await response.json();
    const source = data?.[2];
    if (typeof source === 'string' && source.trim()) {
      const detected = source.trim().toLowerCase();
      if ((detected === 'en' || detected === 'fr') && heuristic && heuristic !== detected) {
        const heuristicScore = scoreLanguage(text, heuristic);
        const detectedScore = scoreLanguage(text, detected);
        if (heuristicScore >= detectedScore + 1) {
          return heuristic;
        }
      }

      return detected;
    }
  } catch {
    // ignore detection failures
  }

  return heuristic;
}

export default {
  getLanguage,
  t,
  translateText,
  detectTextLanguage
};
