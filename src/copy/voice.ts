/**
 * Who the page is talking about.
 *
 * The same components serve two audiences. After taking the test you read about
 * yourself ("colours you will confuse"); open someone else's shared link and you
 * read about them ("colours Tomas will confuse"). Rather than duplicating every
 * component, the handful of words that differ come from here.
 *
 * A name is used when the sharer gave one, and "they" otherwise -- which also
 * keeps the wording correct for anyone who would rather not be gendered.
 */
export interface Voice {
  /** True when addressing the person who took the test. */
  readonly self: boolean;
  /** Subject: "you" or "Tomas" or "they". */
  readonly subject: string;
  /** Possessive: "your" or "Tomas's" or "their". */
  readonly possessive: string;
  /** Object: "you" or "Tomas" or "them". */
  readonly object: string;
  /** Verb agreement for the subject: "" for you/they, "s" for a name. */
  readonly s: string;
  /** "you see" vs "Tomas sees" / "they see". */
  readonly sees: string;
  /** "are" vs "is" / "are". */
  readonly is: string;
  /** "have" vs "has" / "have". */
  readonly has: string;
}

export const SELF: Voice = {
  self: true,
  subject: 'you',
  possessive: 'your',
  object: 'you',
  s: '',
  sees: 'see',
  is: 'are',
  has: 'have',
};

export function otherVoice(name: string | null): Voice {
  if (!name) {
    return {
      self: false,
      subject: 'they',
      possessive: 'their',
      object: 'them',
      s: '',
      sees: 'see',
      is: 'are',
      has: 'have',
    };
  }

  // English possessive for a name already ending in s: "Tomas'" reads better
  // than "Tomas's" to most people, and both are accepted.
  const possessive = /s$/i.test(name) ? `${name}\u2019` : `${name}\u2019s`;

  return {
    self: false,
    subject: name,
    possessive,
    object: name,
    s: 's',
    sees: 'sees',
    is: 'is',
    has: 'has',
  };
}

/** Capitalises a subject for use at the start of a sentence. */
export function initial(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
