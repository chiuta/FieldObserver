# Fixture-uri Field Observer

## `app-generated-zip-media.zip` (SINTETIC)
ZIP „ZIP + media” produs de **codul aplicației** (butonul „⬇ ZIP + media”, v2.2.1), din 6 rânduri sintetice: fotografii desenate pe canvas (JPEG 64x48, PNG 32x24, WebP 40x30), audio = octeți pseudo-aleatorii cu tip MIME declarat (`audio/webm;codecs=opus`, `audio/mp4`) — **nu sunt înregistrări reale** — note cu virgulă, ghilimele, linie nouă și diacritice, o formulă (`=HYPERLINK(...)`) în note și un rând fără GPS. Regenerare: `WRITE_FIXTURE=1 node tests/zip-independent.test.mjs`.

Verificare cu parsere **independente de aplicație**, nu cu codul ei:
- `python3 -I tests/verify_zip.py <zip>`: doar biblioteca standard Python (`zipfile`, `csv`, `hashlib`, `json`, `struct`): `testzip()` (CRC), nume duplicate / coliziuni de majuscule / căi nesigure, coerența EOCD și a antetelor locale, CSV UTF-8 fără BOM cu CRLF, același număr de câmpuri pe rând, antet format numai din termeni Darwin Core, căi `associatedMedia` existente și fără orfani, SHA-256 al fiecărui fișier media.
- Info-ZIP `unzip -t`.
Testul `node tests/zip-independent.test.mjs` generează ZIP-uri noi (6 rânduri + 46 rânduri de stres cu fotografii JPEG 640x480, PNG, audio de 80 KB, note de 1500 de caractere, t identic, coliziuni de nume) și le verifică la fel; a descoperit coliziunile de nume de fișier corectate în 2.2.1.

## De ce nu există `meta.xml`
Ghidul „Darwin Core text guide” (dwc.tdwg.org/text) descrie `meta.xml` (rădăcina `archive` în spațiul de nume `http://rs.tdwg.org/dwc/text/`, `core`/`extension` cu `rowType`, `files/location`, `field index/term`), dar fișierul XSD oficial (`tdwg_dwc_text.xsd`) **nu a putut fi descărcat** în acest mediu (acces blocat), deci un `meta.xml` nu putea fi validat față de schemă. Conform regulii, nu a fost adăugat. În plus, `associatedMedia` conține căi relative în ZIP, iar GBIF cere URL-uri publice pentru multimedia, deci arhiva nu ar fi publicabilă oricum. Exportul rămâne „CSV Darwin Core + media într-un ZIP, nu arhivă Darwin Core”, netestat cu GBIF.

## Limite
- Media sintetice; fără fotografii EXIF reale sau înregistrări reale de la dispozitive.
- Nu se verifică cu 7-Zip, Windows Explorer sau macOS Archive Utility (indisponibile aici); doar Python `zipfile` și Info-ZIP.
