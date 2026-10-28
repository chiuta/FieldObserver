# Jurnal de modificări — Field Observer

Format: [SemVer](https://semver.org/lang/ro/) MAJOR.MINOR.PATCH.

## 2.2.1 — 2026-10-28 (anterior: 2.2.0)

Corectat:
- Export „ZIP + media”: numele fișierelor din `media/` pot coincide când ID-urile rândurilor diferă doar prin caractere înlocuite cu `_` (ex. `x:1` și `x_1`) sau doar prin majuscule/minuscule (`CASE-1` / `case-1`). Rezultatul avea două intrări cu același nume în ZIP (o fotografie o suprascria pe cealaltă la extragere, iar ambele rânduri CSV indicau aceeași cale) sau fișiere care se suprapun pe Windows/macOS. Numele sunt acum unice fără a ține seama de majuscule (sufix `_2`, `_3`…). Descoperit cu un verificator independent (Python `zipfile`/`csv`).

Teste:
- Test nou `tests/zip-independent.test.mjs` + `tests/verify_zip.py` (doar biblioteca standard Python și `unzip -t`) și `tests/fixtures/app-generated-zip-media.zip` (ZIP produs de codul aplicației; sintetic). Nu s-a adăugat `meta.xml`: schema XSD TDWG nu a putut fi obținută pentru validare (vezi `tests/fixtures/README.md`).

## 2.2.0 — 2026-10-27 (anterior: 2.1.0)

Fotografii și audio în export:
- Buton nou „⬇ ZIP + media” în Arhivă: ZIP „store” (CRC-32), cu `occurrence.csv` Darwin Core, fotografiile și audio ca fișiere în `media/`, `LEAME-README.txt` (RO + EN); `associatedMedia` cu căi relative separate prin ` | `.
- Verificat cu `zipfile` din Python (CRC) și SHA-256 al octeților media față de IndexedDB; test nou `tests/zip-media.test.mjs`.
- Limite documentate: nu e arhivă Darwin Core (fără meta.xml), GBIF cere URL-uri publice, netestat cu GBIF; `scientificName` rămâne gol (specia nu e captată). Traduceri noi fr/it/es/pt/de/hu = automate, marcate.
- CSV-ul Darwin Core simplu și iNaturalist: neschimbate.

---

## 2.1.0 — 2026-10-27 (anterior: v2.0.0)

Stare: stabil · Offline: complet

Aplicat după mini-recenzia din 2026-10-27.

### Adăugat / modificat
- Export **Darwin Core** (CSV pentru GBIF) din Arhivă: `occurrenceID`, `basisOfRecord=HumanObservation`, `occurrenceStatus`, `eventDate` (ISO 8601 UTC), `decimalLatitude`/`decimalLongitude`, `geodeticDatum=EPSG:4326`, `coordinateUncertaintyInMeters`, `minimum/maximumElevationInMeters`, `scientificName` (gol), `occurrenceRemarks`, `datasetName`, `dynamicProperties` (JSON: azimut, elevație, lux, baterie).
- Export **iNaturalist** (CSV): primele 8 coloane în ordinea cerută de importul lor (iNaturalist citește după poziție, nu după numele antetului — verificat în documentația/forumul iNaturalist).
- Notele cu `=`, `+`, `-`, `@` la început sunt neutralizate (apostrof); coordonatele negative rămân numere; coordonate invalide nu se exportă; rapoartele vechi fără `t` folosesc `ts`.
- Textele în 8 limbi (titluri, toast-uri); README (8 limbi): secțiunea „Export Darwin Core (GBIF) și iNaturalist”; Stare: stabil · Offline: complet.
- Test nou `tests/darwincore.test.mjs` (28 de verificări); versiune 2.1.0 (index.html, sw.js, app.json, README, `fff-info`, antetul GPX/`.fff.json`; hash CSP + `sha256` recalculate).

### Neimplementat
- **Fotografii atașate: planificat.** Nu sunt incluse în CSV (base64 uriaș, neacceptat de GBIF ca `associatedMedia`); rămân în JSON / `.fff.json`. O arhivă Darwin Core cu extensia Simple Multimedia (ZIP) cere un generator ZIP care nu există în aplicație.
- **Câmp de specie în aplicație:** aplicația nu captează taxonul, deci `scientificName` / „Taxon name” sunt goale și se completează de utilizator înainte de încărcare (documentat în README). Adăugarea unui câmp ar schimba schema rapoartelor (IndexedDB, import, 8 limbi) și nu face parte dintr-o recenzie sigură.
- Compatibilitatea a fost testată pe structura fișierului, nu pe încărcări reale în GBIF/iNaturalist.

## 2.0.0
- Versiunea anterioară (vezi istoricul din README).
