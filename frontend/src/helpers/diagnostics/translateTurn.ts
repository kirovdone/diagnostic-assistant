// Translating a line the server wrote.
//
// The question bank is English in `questions.py` and the catalogues key on the English
// string, so a prompt round-trips through `t()` like any other label. Two of them do not,
// because `_specialise_error_code` builds them at request time with the code the
// candidates actually print: "Does the panel show E-207?" and "Yes, E-207". A generated
// string cannot be a static key.
//
// So those two are matched back into the key they came from and the code goes through as
// a parameter. The alternative is the server returning a key and its params on the wire,
// which is the right answer and is a change to the response shape; this is the frontend
// half of it, and it is the half that can ship without one.

import type { TranslateParams } from "@/helpers/i18n/useTranslation";

type Translate = (key: string, params?: TranslateParams) => string;

const PROMPT_WITH_CODE = /^Does the panel show (.+)\?$/;
const OPTION_WITH_CODE = /^Yes, (.+)$/;

export function translateTurn(t: Translate, text: string): string {
  const prompt = PROMPT_WITH_CODE.exec(text);
  if (prompt) return t("Does the panel show {{code}}?", { code: prompt[1] });

  const option = OPTION_WITH_CODE.exec(text);
  // "Yes, a code is shown" is a static key and must not be caught by this.
  if (option && /^[A-Z0-9][\w-]*$/.test(option[1])) {
    return t("Yes, {{code}}", { code: option[1] });
  }

  return t(text);
}
