# Kasnim na ispit

Mala 3D igra iz prvog lica u pregledniku. Student kasni na ispit i ima 90 sekundi
da u zgradi fakulteta pronade zadanu dvoranu. Svaka runda nasumicno bira cilj.
Po hodnicima hodaju studenti koji te usporavaju, a salice kave te ubrzavaju.

Radena u Babylon.js-u, bez vanjskih 3D modela i zvucnih datoteka: sve je
sagradeno od primitiva i proceduralnih materijala, a zvukovi se generiraju
Web Audio API-jem.

## Pokretanje

Treba ti Node 20 ili noviji.

```bash
npm install
npm run dev
```

Otvori adresu koju ispise Vite, obicno <http://localhost:5173>.

Ostale naredbe:

```bash
npm run build     # provjera tipova i produkcijski build u dist/
npm run preview   # posluzi sagradeni dist/ lokalno
```

## Kako se igra

| Tipka / potez | Radnja |
| --- | --- |
| `W` `A` `S` `D` ili strelice | kretanje |
| mis | gledanje uokolo (klik hvata pokazivac) |
| `R` | nova runda |
| `I` | Babylon Inspector, samo u razvojnom nacinu |
| lijeva polovica ekrana (dodir) | virtualni joystick |
| desna polovica ekrana (dodir) | povlacenje prstom za pogled |

Pravila:

- Na pocetku runde dobivas oznaku dvorane, na primjer "Ispit: dvorana B3".
- Ulazak u ciljnu dvoranu znaci pobjedu, a bodovi su preostale sekunde.
- Ulazak u krivu dvoranu oduzima 5 sekundi.
- Sudar sa studentom usporava te na 50 % brzine na 2 sekunde.
- Kava te ubrzava na 150 % brzine na 5 sekundi.
- Najbolji rezultat cuva se u `localStorage`.

## Struktura projekta

```
src/
  main.ts                 pokretanje enginea i render petlja
  config.ts               sve podesive konstante igre
  game/Game.ts            stanje igre, timer, pobjeda i poraz, restart
  level/levelData.ts      mapa kata kao niz stringova, dvorane i putokazi
  level/LevelBuilder.ts   gradi 3D kat iz mape
  player/Player.ts        kamera iz prvog lica, kontrole, brzina, efekti
  npc/Students.ts         studenti koji hodaju hodnicima
  pickups/Coffee.ts       salice kave
  ui/Hud.ts               odbrojavanje, ciljna dvorana, ikone efekata, poruke
  ui/Screens.ts           pocetni ekran, pobjeda, poraz, najbolji rezultat
  ui/TouchControls.ts     virtualni joystick i pogled prstom
  audio/Sfx.ts            zvukovi preko Web Audio API-ja
  dev/inspector.ts        Babylon Inspector na tipku I, samo u razvoju
```

Moduli su namjerno razdvojeni tako da vise ljudi moze raditi paralelno:
mapa, igrac, NPC-ovi i sucelje ne diraju iste datoteke. Jedina zajednicka
tocka je `config.ts` s konstantama i `Game.ts` koji ih povezuje.

## Kako urediti mapu

Cijeli kat opisan je u `src/level/levelData.ts`. Jedna celija mreze je 2 metra,
zidovi su visoki 3 metra.

### Mreza

`FLOOR_MAP` je niz stringova jednake duljine. Znakovi:

| Znak | Znacenje |
| --- | --- |
| `#` | zid |
| `.` | hodnik |
| `o` | pod dvorane |
| `+` | vrata dvorane |
| `S` | pocetna pozicija igraca |
| `C` | kava |
| `N` | pocetna tocka studenta |

Pravila kojih se treba drzati:

- Svi redovi moraju biti jednako dugi, a vanjski rub mora biti zid.
- Svaka celija `+` mora imati tocno jednog susjeda `o` i tocno jednog susjeda hodnika.
- Svaka dvorana mora biti dostupna iz `S`.

### Dvorane

`ROOMS` povezuje oznaku dvorane s celijom njezinih vrata:

```ts
{ label: "A3", door: { col: 11, row: 13 } }
```

Iznad vrata se automatski gradi tablica s oznakom, a na samim vratima
nevidljiva zona okidaca. Dodavanje devete dvorane znaci dodati prostoriju u
`FLOOR_MAP` i jedan redak u `ROOMS`; ostatak igre se ne dira.

### Putokazi

`SIGNPOSTS` su ploce objesene o strop:

```ts
{ col: 19, row: 17, dir: "s", text: "← A1–A4      B1–B4 →" }
```

`dir` je strana s koje se ploca cita. Igrac koji hoda prema sjeveru nalazi se
juzno od ploce, pa za njega treba `dir: "s"`. Ploca je jednostrana, pa za oba
smjera hodnika dodaj dva unosa.

### Zamjena mape modelom iz Blendera

`LevelBuilder.ts` izvozi funkciju `buildLevelFromGrid(scene)` koja vraca objekt
tipa `BuiltLevel`. Ostatak igre poznaje samo to sucelje: pocetnu poziciju,
mjesta kava i studenata, zone dvorana i provjeru prohodnosti.

Da kat dode iz `.glb` datoteke, dovoljno je napisati drugu funkciju koja vraca
isti `BuiltLevel` i zamijeniti jedan poziv u `Game.ts`. Nijedan drugi modul se
ne mijenja.

## Napomena o iCloudu

Projekt je u mapi `Desktop`, koju iCloud sinkronizira. iCloud datoteke u
`node_modules` drzi bez lokalnog sadrzaja i dohvaca ih tek pri citanju, pa
`tsc` ume raditi i po pola sata umjesto nekoliko sekundi.

Isti build izvan iCloud mape traje oko dvije sekunde. Ako build traje predugo,
premjesti projekt izvan `Desktop` i `Documents`, na primjer u `~/Projects`:

```bash
mv ~/Desktop/EV/kasnim-na-ispit ~/Projects/
```

## Objava na GitHub Pages

U repozitoriju je `.github/workflows/deploy.yml`. Nakon prvog pusha na `main`:

1. U postavkama repozitorija otvori **Settings → Pages**.
2. Pod **Source** odaberi **GitHub Actions**.

Workflow sam postavlja `BASE_PATH` na `/<ime-repozitorija>/`, sto `vite.config.ts`
cita i koristi kao `base`, pa putanje do skripti rade i na pod-putanji.

## Performanse

- Staticni zidovi spajaju se u nekoliko velikih meshova po regijama kata.
- Svi materijali dijele isto ogranicenje broja svjetala (`LOOK.MAX_LIGHTS`),
  pa se mesh crta u jednom prolazu.
- Nema sjena; dubinu daju emissive neonske cijevi i `GlowLayer`.
- Na uredajima s visokim DPI-jem render se skalira ispod pune rezolucije ekrana.
- `@babylonjs/inspector` se ucitava samo u razvoju. U produkciji ta grana
  otpada, pa je `dist/` oko 1,8 MB umjesto 12 MB.
