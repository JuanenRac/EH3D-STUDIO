/* The texts of the 29 languages that are not in the rows of texts.ts: one JSON file per language, each key with its text.
 * The two variants (pt-br, fr-ca) hold only what differs from their main language. GPL-3.0-or-later. */
import bg from "./bg.json";
import hr from "./hr.json";
import cs from "./cs.json";
import da from "./da.json";
import nl from "./nl.json";
import et from "./et.json";
import fi from "./fi.json";
import el from "./el.json";
import hu from "./hu.json";
import ga from "./ga.json";
import lv from "./lv.json";
import lt from "./lt.json";
import mt from "./mt.json";
import pl from "./pl.json";
import ro from "./ro.json";
import sk from "./sk.json";
import sl from "./sl.json";
import sv from "./sv.json";
import no from "./no.json";
import is from "./is.json";
import uk from "./uk.json";
import ru from "./ru.json";
import sr from "./sr.json";
import sq from "./sq.json";
import ca from "./ca.json";
import gl from "./gl.json";
import eu from "./eu.json";
import ptBr from "./pt-br.json";
import frCa from "./fr-ca.json";

export const LOCALES: Record<string, Record<string, string>> = {
  bg, hr, cs, da, nl, et, fi, el, hu, ga, lv, lt, mt, pl, ro, sk, sl, sv, no, is, uk, ru, sr, sq, ca, gl, eu,
  "pt-br": ptBr,
  "fr-ca": frCa,
};
