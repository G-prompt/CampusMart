/**
 * CampusMart institution discovery: name, stored shortName, common aliases,
 * and derived initials. This is a search-only lookup. It NEVER changes
 * official institution records or verification eligibility.
 */
export type SearchableInstitution = {
  name: string;
  shortName?: string | null;
};

function compact(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/** Well-known searchable aliases, NOT a replacement for official shortName. */
const NIGERIAN_ALIASES: ReadonlyArray<{
  namePart: string;
  aliases: readonly string[];
}> = [
  { namePart: "abia state university", aliases: ["ABSU"] },
  { namePart: "adamawa state university", aliases: ["ADSU"] },
  { namePart: "adekunle ajasin university", aliases: ["AAUA"] },
  { namePart: "ahmadu bello university", aliases: ["ABU"] },
  { namePart: "akwa ibom state university", aliases: ["AKSU"] },
  { namePart: "ambrose alli university", aliases: ["AAU"] },
  { namePart: "bayero university", aliases: ["BUK"] },
  { namePart: "benue state university", aliases: ["BSU"] },
  { namePart: "delta state university", aliases: ["DELSU"] },
  { namePart: "ebonyi state university", aliases: ["EBSU"] },
  { namePart: "ekiti state university", aliases: ["EKSU"] },
  { namePart: "enugu state university", aliases: ["ESUT"] },
  { namePart: "federal university of agriculture abeokuta", aliases: ["FUNAAB"] },
  { namePart: "federal university of agriculture makurdi", aliases: ["FUAM", "JOSTUM"] },
  { namePart: "federal university of technology akure", aliases: ["FUTA"] },
  { namePart: "federal university of technology minna", aliases: ["FUTMINNA"] },
  { namePart: "federal university of technology owerri", aliases: ["FUTO"] },
  { namePart: "federal university of technology yola", aliases: ["FUTY"] },
  { namePart: "federal university oye ekiti", aliases: ["FUOYE"] },
  { namePart: "federal university lokoja", aliases: ["FULOKOJA"] },
  { namePart: "federal university lafia", aliases: ["FULAFIA"] },
  { namePart: "federal university dutse", aliases: ["FUD"] },
  { namePart: "federal university gusau", aliases: ["FUGUS"] },
  { namePart: "federal university otuoke", aliases: ["FUOTUOKE"] },
  { namePart: "ignatius ajuru university", aliases: ["IAUE"] },
  { namePart: "imo state university", aliases: ["IMSU"] },
  { namePart: "kaduna state university", aliases: ["KASU"] },
  { namePart: "kano university of science", aliases: ["KUST"] },
  { namePart: "ladoke akintola university", aliases: ["LAUTECH"] },
  { namePart: "lagos state university", aliases: ["LASU"] },
  { namePart: "modibbo adama university", aliases: ["MAU", "MAUTECH"] },
  { namePart: "niger delta university", aliases: ["NDU"] },
  { namePart: "namdi azikiwe university", aliases: ["UNIZIK"] },
  { namePart: "nnamdi azikiwe university", aliases: ["UNIZIK"] },
  { namePart: "obafemi awolowo university", aliases: ["OAU"] },
  { namePart: "olusegun agagu university", aliases: ["OAUSTECH"] },
  { namePart: "ondo state university of science", aliases: ["OSUSTECH", "OAUSTECH"] },
  { namePart: "osun state university", aliases: ["UNIOSUN"] },
  { namePart: "pamo university", aliases: ["PAMO"] },
  { namePart: "rivers state university", aliases: ["RSU", "RSUST"] },
  { namePart: "tai solarin university", aliases: ["TASUED"] },
  { namePart: "university of abuja", aliases: ["UNIABUJA"] },
  { namePart: "university of benin", aliases: ["UNIBEN"] },
  { namePart: "university of calabar", aliases: ["UNICAL"] },
  { namePart: "university of ibadan", aliases: ["UI"] },
  { namePart: "university of ilorin", aliases: ["UNILORIN"] },
  { namePart: "university of jos", aliases: ["UNIJOS"] },
  { namePart: "university of lagos", aliases: ["UNILAG"] },
  { namePart: "university of maiduguri", aliases: ["UNIMAID"] },
  { namePart: "university of nigeria", aliases: ["UNN"] },
  { namePart: "university of port harcourt", aliases: ["UNIPORT"] },
  { namePart: "university of port-harcourt", aliases: ["UNIPORT"] },
  { namePart: "university of uyo", aliases: ["UNIUYO"] },
  { namePart: "university of agriculture makurdi", aliases: ["FUAM", "JOSTUM"] },
  { namePart: "university of science and technology port harcourt", aliases: ["RSUST"] },
  { namePart: "yaba college of technology", aliases: ["YABATECH"] },
  { namePart: "federal polytechnic nekede", aliases: ["FEDPOLYNEKEDE", "NEKEDEPOLY"] },
  { namePart: "federal polytechnic ilaro", aliases: ["ILAROPOLY"] },
  { namePart: "federal polytechnic oko", aliases: ["OKOPOLY"] },
  { namePart: "kenule beeson saro wiwa polytechnic", aliases: ["KENPOLY", "BORIPOLY"] },
  { namePart: "rivers state polytechnic", aliases: ["KENPOLY", "BORIPOLY"] },
];

function initials(name: string): string {
  const head = name.split(",")[0];
  const words = head.match(/[a-z0-9]+/gi) ?? [];
  return words
    .filter((word) => !["the", "of", "and", "for", "at", "in"].includes(word.toLowerCase()))
    .map((word) => word[0])
    .join("");
}

/** Display a concise, recognised abbreviation without overwriting official data. */
export function institutionDisplayCode(institution: SearchableInstitution): string {
  const stored = (institution.shortName ?? "").trim();
  if (/^[a-z0-9-]{2,12}$/i.test(stored)) return stored;
  const normalizedName = compact(institution.name);
  const match = NIGERIAN_ALIASES.find((rule) =>
    normalizedName.includes(compact(rule.namePart))
  );
  if (match) return match.aliases[0];
  const acronym = initials(institution.name).toUpperCase();
  return acronym.length >= 2 && acronym.length <= 7 ? acronym : stored || "Campus";
}

export function institutionSearchScore(
  institution: SearchableInstitution,
  search: string
): number | null {
  const query = compact(search);
  if (!query) return 0;

  const name = compact(institution.name);
  const shortName = compact(institution.shortName ?? "");
  const allTerms = [name, shortName, compact(initials(institution.name))];
  for (const rule of NIGERIAN_ALIASES) {
    if (name.includes(compact(rule.namePart))) {
      for (const alias of rule.aliases) allTerms.push(compact(alias));
    }
  }
  const terms = Array.from(new Set(allTerms.filter(Boolean)));
  if (terms.some((term) => term === query)) return 0;
  if (terms.some((term) => term.startsWith(query))) return 1;
  if (terms.some((term) => term.includes(query))) return 2;
  return null;
}

export function matchesInstitutionSearch(
  institution: SearchableInstitution,
  search: string
): boolean {
  return institutionSearchScore(institution, search) !== null;
}
