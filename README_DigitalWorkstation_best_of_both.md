# Digital Workstation

Deze repository bevat het **Digital Workstation** dat tijdens mijn stage bij Sirris werd ontwikkeld.

Deze README is vooral bedoeld als **overdrachtsdocument voor Sirris**. Het doel is dat iemand die de code later opnieuw opent snel begrijpt:

- wat de website doet;
- welke schermen er zijn;
- hoe de verschillende rollen met elkaar communiceren;
- waar Product 1 en Product 2 in de code zitten;
- hoe de camera- en kwaliteitscontroles momenteel werken;
- wat al echt werkt en wat nog prototypegedrag is;
- waar je moet kijken als je later iets wilt aanpassen.

**Live versie:**  
https://florinedespiegeleer.github.io/DigitalWorkstation/

---

# 1. Wat doet de website?

Het Digital Workstation ondersteunt de omstelling tussen **Product 1** en **Product 2** en begeleidt de volledige workflow rond:

```text
huidig product
→ product afvoeren
→ nieuwe productieopdracht
→ omstelling
→ malcontrole
→ productie
→ eindcontrole
→ product afleveren of afkeuren
→ volgende cyclus
```

De applicatie bestaat uit vier samenwerkende interfaces:

- **Operator** — begeleidt de omstelling, productie en eindcontrole;
- **Camera** — voert de malcontrole en productcontrole uit;
- **Waterspider** — ondersteunt materiaalvoorziening, voorraadcontrole en voorbereiding;
- **Manager** — volgt live status en kwaliteit op en plant omstellingen.

De verschillende interfaces kunnen tegelijk op aparte toestellen geopend zijn. Ze wisselen status-, planning- en kwaliteitsinformatie uit via `ntfy.sh`.

## Architectuur in één oogopslag

```text
                         ┌─────────────┐
                         │   Manager   │
                         │ planning &  │
                         │ live status │
                         └──────┬──────┘
                                │
                                │
                                ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│ Waterspider │ ◄──────► │   ntfy.sh   │ ◄──────► │  Operator   │
│ materiaal & │          │ communicatie│          │ werkflow &  │
│ voorraad    │          └──────┬──────┘          │ productie   │
└─────────────┘                 │                 └──────┬──────┘
                                │                        │
                                │ QC-resultaten          │ controle-aanvraag
                                ▼                        ▼
                         ┌─────────────┐          ┌─────────────┐
                         │   Manager   │          │   Camera    │
                         │ kwaliteits- │          │ mal & QC    │
                         │ opvolging   │          └─────────────┘
                         └─────────────┘
```

In de praktijk kan dit bijvoorbeeld zo gebruikt worden:

- Operator op een tablet of pc aan de werkpost;
- Camera op een smartphone;
- Waterspider op een klein mobiel toestel of polstablet;
- Manager op een pc.

Lokale toestand wordt daarnaast opgeslagen in `localStorage` en `sessionStorage`.

> [!IMPORTANT]
> **Deze applicatie is een functionele demonstrator en nog geen productieklare industriële toepassing.**
>
> De belangrijkste prototypebeperkingen zijn:
>
> - de producteindcontrole is momenteel gesimuleerd en publiceert automatisch een `OK`-resultaat;
> - de `ntfy.sh`-topics zijn publiek en dus niet geschikt als definitieve industriële communicatie;
> - gegevens worden hoofdzakelijk lokaal in de browser opgeslagen en niet in een centrale database;
> - een aantal omstelschermen bevatten nog Product 2-specifieke teksten en data;
> - geplande datum/tijd is momenteel nog geen echte automatisch tijdgestuurde planning.
>
> De volledige lijst met beperkingen staat verderop in **sectie 52 — Huidige beperkingen / zaken die nog niet volledig afgewerkt zijn**.

## Snel starten

Benodigd:

```text
Node.js
npm
```

In de projectmap:

```bash
npm install
npm run dev
```

Voor een productiebuild:

```bash
npm run build
```

Voor lokaal bekijken van de build:

```bash
npm run preview
```

De scripts staan in:

```text
package.json
```

---

# 2. Startscherm en toegang

Bij het openen van de website verschijnt eerst het startscherm met vier keuzes:

- Operator
- Camera
- Waterspider
- Manager

Bestand:

```text
src/main.tsx
```

De vier interfaces zijn bereikbaar via `AppMode`:

```ts
type AppMode =
  | 'home'
  | 'operator'
  | 'camera'
  | 'waterspider'
  | 'manager';
```

## PIN-codes

Er is een eenvoudige PIN-controle ingebouwd.

Momenteel:

```text
Operator     1234
Camera       1234
Waterspider  1234
Manager      9999
```

De PIN's staan niet letterlijk als constante in de interface, maar worden in `main.tsx` gehasht met een eenvoudige `simpleHash()`-functie.

Dit is **geen echte beveiliging**. Het is alleen bedoeld om de werking aan te tonen.

Voor echt productiegebruik zou dit vervangen moeten worden door gebruikersaccounts of een server-side login.

## Wat wordt onthouden?

De ontgrendelde rol en het laatst geopende hoofdscherm worden in `sessionStorage` bewaard.

Belangrijke keys:

```text
sirris_unlocked_modes
sirris_app_mode
```

Dat betekent:

- refresh van de pagina blijft meestal in dezelfde rol;
- tabblad volledig sluiten = PIN opnieuw ingeven.

---

# 3. Operator-interface

De Operator-interface is het grootste deel van de applicatie.

Bestand:

```text
src/main.tsx
```

Functie:

```ts
OperatorApp()
```

De Operator doorloopt de volledige flow van:

```text
huidig product
→ product afvoeren
→ nieuwe productieopdracht
→ omstelling
→ malcontrole
→ productie
→ eindcontrole
→ product afleveren of afkeuren
→ volgende cyclus
```

De mogelijke schermen staan in `FlowStep`.

```ts
type FlowStep =
  | 'product1-approved'
  | 'changeover-command'
  | 'remove-product1'
  | 'main-dashboard'
  | 'changeover-step1'
  | 'changeover-step2'
  | 'changeover-step3'
  | 'changeover-step4'
  | 'changeover-step5'
  | 'camera-check'
  | 'production'
  | 'final-qc'
  | 'deliver-product'
  | 'reject-product'
  | 'finish'
  | 'settings';
```

---

# 4. Productwisselrichting

De website ondersteunt in de logica twee richtingen:

```text
Product 1 → Product 2
Product 2 → Product 1
```

In de code:

```ts
type ChangeoverDirection =
  | 'P1_TO_P2'
  | 'P2_TO_P1';
```

Op basis van deze richting worden `fromProduct` en `toProduct` bepaald.

Bijvoorbeeld:

```text
P1_TO_P2

fromProduct = Product 1
toProduct   = Product 2
```

en omgekeerd voor `P2_TO_P1`.

### Belangrijk

De centrale flow ondersteunt beide richtingen, maar een aantal losse omstelschermen bevatten momenteel nog teksten die specifiek naar **Product 2** verwijzen.

Voorbeelden:

```text
src/components/ChangeoverStep2Screen.tsx
src/components/ChangeoverStep3Screen.tsx
src/components/ChangeoverStep4Screen.tsx
src/components/ChangeoverStep5Screen.tsx
```

Als de omstelling Product 2 → Product 1 later volledig correct moet worden ondersteund, moeten deze schermen nog productspecifiek gemaakt worden.

---

# 5. Begin van de Operator-flow

De Operator start standaard op:

```text
product1-approved
```

Dit scherm stelt voor dat het huidige product eerst is goedgekeurd.

Component:

```text
src/components/Product1ApprovedScreen.tsx
```

Na vrijgave gaat de flow naar:

```text
remove-product1
```

Hier wordt aangegeven waar het huidige product naartoe moet.

Component:

```text
src/components/RemoveProduct1Screen.tsx
```

Vanaf het moment dat het huidige product wordt vrijgegeven, start ook de omsteltimer.

Daarna volgt:

```text
changeover-command
```

Component:

```text
src/components/ChangeoverCommandScreen.tsx
```

Dit scherm toont de nieuwe productieopdracht:

```text
van Product X
naar Product Y
aantal stuks
```

Na bevestiging komt de Operator op het omstellingsdashboard.

---

# 6. Omstellingsdashboard

Component:

```text
src/components/MainDashboardScreen.tsx
```

Het dashboard toont onder andere:

- huidig product;
- nieuw product;
- status van de omstelling;
- geplande omstellingen;
- ordervoortgang;
- aantal geproduceerde stuks;
- totale orderhoeveelheid;
- knop `Start omstelling`;
- knop `Start productie`.

De orderteller gebruikt:

```text
producedCount
orderQuantity
```

Voorbeeld:

```text
12 / 50 stuks
```

## Beveiliging tegen productie starten zonder omstelling

Als de Operator productie probeert te starten terwijl:

- de omstelling nog niet is afgerond;
- en de mal nog niet is goedgekeurd;

dan verschijnt een waarschuwing.

Component:

```text
src/components/WarningModal.tsx
```

Vanuit deze waarschuwing kan de Operator rechtstreeks naar de malcontrole gaan.

---

# 7. Begeleide omstelling

De omstelling bestaat uit vijf stappen.

## Stap 1 — Werkpost vrijmaken

Bestand:

```text
src/components/ChangeoverStep1Screen.tsx
```

De Operator krijgt een checklist om de werkpost vrij te maken.

Pas wanneer alle checklist-items zijn aangeduid, kan de flow verder.

---

## Stap 2 — Mal plaatsen

Bestand:

```text
src/components/ChangeoverStep2Screen.tsx
```

De Operator plaatst de mal voor het nieuwe product.

Na deze stap wordt niet rechtstreeks naar stap 3 gegaan.

De flow gaat eerst naar:

```text
camera-check
```

Dit is bewust gedaan zodat de mal wordt gecontroleerd voordat de Operator verdergaat.

---

# 8. Malcontrole

Operator-component:

```text
src/components/CameraCheckScreen.tsx
```

De Operator-tablet toont:

```text
Wachten op controlefoto...
```

De tablet verwacht een resultaat van de Camera-interface.

Het resultaat moet aan twee voorwaarden voldoen:

1. `context` moet `camera-check` zijn;
2. het resultaat moet voor het juiste product zijn.

Voorbeeld:

```json
{
  "product": "product2",
  "status": "ok",
  "percentage": 0.01,
  "context": "camera-check",
  "timestamp": 123456789
}
```

Mogelijke resultaten:

```text
OK    → Mal correct gemonteerd
NOK   → Mal corrigeren
```

Als de malcontrole via de normale begeleide omstelling werd bereikt:

```text
NOK → terug naar stap 2
OK  → verder naar stap 3
```

Als de malcontrole via de snelle waarschuwing op het dashboard werd geopend, is de terugkeer iets anders.

---

# 9. Hoe de Camera automatisch weet wanneer ze moet openen

De Camera-interface luistert naar de actuele status van de Operator.

Hiervoor wordt het statuskanaal gebruikt:

```text
sirris-mfg-demo-k7q2x9-status
```

Wanneer de Operator op:

```text
camera-check
```

komt, schakelt de telefoon automatisch naar de malcontrole.

Wanneer de Operator op:

```text
final-qc
```

komt, schakelt de telefoon automatisch naar de productcontrole.

De Camera haalt bij het openen eerst ook het laatst bekende statusbericht van de afgelopen twee uur op.

Dit gebeurt via:

```text
https://ntfy.sh/.../json?poll=1&since=2h
```

Daarna luistert de Camera live verder via SSE.

De reden hiervoor is praktisch: als de Operator al op een controlescherm stond vóór de Camera-interface geopend werd, zou de telefoon anders het eerdere statusbericht missen.

---

# 10. Camera-interface

De Camera-interface zit volledig in:

```text
src/main.tsx
```

Functie:

```ts
CameraApp()
```

De camera heeft verschillende modi:

```text
waiting
select
mal
product
```

## Waiting

Dit is het normale wachtbeeld.

Tekst:

```text
Wachten op de operator...
```

De telefoon kan hier gewoon open blijven staan.

Zodra de Operator een controle nodig heeft, verandert het scherm automatisch.

Er staan ook twee kleine fallback-knoppen rechtsonder waarmee handmatig naar een controle kan worden gegaan als de automatische communicatie niet werkt.

---

# 11. Malcontrole via kleurherkenning

De huidige malcontrole gebruikt een eenvoudige kleurdetectie.

De camera neemt een foto en bekijkt de middelste 70% van het beeld.

De buitenste rand van de foto wordt dus niet meegenomen in de analyse.

## Product 1

Er wordt gezocht naar een blauwe kleur.

Ongeveer:

```text
Hue:        190 – 250°
Saturation: > 0.50
Value:      > 0.20
```

## Product 2

Er wordt gezocht naar een gele kleur.

Ongeveer:

```text
Hue:        40 – 70°
Saturation: > 0.50
Value:      > 0.30
```

De drempel staat momenteel op:

```ts
COLOR_THRESHOLD_PERCENT = 0.02
```

De huidige logica interpreteert een percentage boven deze drempel als:

```text
error
```

en anders als:

```text
ok
```

Dit is specifiek afgestemd op de demo-opstelling.

Als de kleuren, mal of achtergrond later veranderen, moet deze logica opnieuw getest en eventueel aangepast worden.

Zoeken in:

```text
src/main.tsx
```

Functie:

```ts
analyseImage()
```

---

# 12. Stap 3 — Onderdelen controleren

Bestand:

```text
src/components/ChangeoverStep3Screen.tsx
```

De Operator krijgt een onderdelenchecklist.

Momenteel staat deze checklist nog hardcoded voor Product 2.

Voorbeelden:

```text
1 × dwarsprofiel 630×30 mm
2 × langsprofiel 370×30 mm
4 × wielen
Lange Nutensteinen
M3 T-moeren
Benodigde M3-bouten
```

Als Product 1 hier volledig correct ondersteund moet worden, moet deze lijst afhankelijk gemaakt worden van `toProduct`.

---

# 13. Stap 4 — Gereedschap controleren

Bestand:

```text
src/components/ChangeoverStep4Screen.tsx
```

Momenteel verwacht dit scherm:

```text
1 × M3 inbussleutel
```

De Operator controleert:

```text
Beschikbaar
Bruikbaar
```

Ook dit scherm is momenteel vooral afgestemd op Product 2.

---

# 14. Stap 5 — Omstelling afronden

Bestand:

```text
src/components/ChangeoverStep5Screen.tsx
```

Het scherm toont een samenvatting van de afgeronde omstelling.

Na bevestiging wordt:

```ts
changeoverCompleted = true
```

Daarna keert de Operator terug naar het omstellingsdashboard.

Vanaf daar kan productie gestart worden.

---

# 15. Productie-instructies

Bestand:

```text
src/components/ProductionStepsScreen.tsx
```

Hier staan de werkelijke montage-instructies voor beide producten.

Er zijn twee aparte arrays:

```ts
PRODUCT1_STEPS
PRODUCT2_STEPS
```

Als later montage-instructies aangepast moeten worden, is dit dus één van de belangrijkste bestanden.

---

# 16. Product 1 — huidige montageflow

Product 1 bevat momenteel 14 stappen.

In grote lijnen:

```text
1. Neem twee profielen 630×30 mm
2. Schuur de profielen
3. Plaats T-moeren in het midden
4. Neem voorbereid profiel 370×60 mm
5. Lijn bevestigingspunten uit
6. Bevestig profielstructuur
7. Plaats linkerzijde in mal
8. Plaats lange Nutensteinen links
9. Monteer wielen links
10. Plaats rechterzijde in mal
11. Plaats lange Nutensteinen rechts
12. Monteer wielen rechts
13. Monteer handvat
14. Eindproduct klaar voor controle
```

De gebruikte gereedschappen worden per stap meegegeven.

Voorbeeld:

```ts
requiresTool: true
toolName: 'M3 inbussleutel'
```

of:

```ts
toolName: 'M5 inbussleutel'
```

---

# 17. Product 2 — huidige montageflow

Product 2 bevat momenteel 13 stappen.

In grote lijnen:

```text
1. Neem twee profielen 370×30 mm
2. Schuur de profielen
3. Plaats T-moeren in het midden
4. Neem voorbereid profiel 630×30 mm
5. Lijn bevestigingspunten uit
6. Bevestig profielstructuur
7. Plaats linkerzijde in mal
8. Plaats lange Nutensteinen links
9. Monteer wielen links
10. Plaats rechterzijde in mal
11. Plaats lange Nutensteinen rechts
12. Monteer wielen rechts
13. Eindproduct klaar voor controle
```

Product 2 heeft geen aparte handvatstap.

---

# 18. Afbeeldingen bij montage-instructies

De montage-instructies kunnen per stap een afbeelding bevatten.

Dit gebeurt met:

```ts
imageUrl
```

Een aantal afbeeldingen zijn rechtstreeks als grote base64-data in:

```text
ProductionStepsScreen.tsx
```

opgenomen.

Dat maakt het bestand erg groot.

Als deze code later verder ontwikkeld wordt, is het netter om de afbeeldingen te verplaatsen naar bijvoorbeeld:

```text
public/images/
```

en daarna gewone paden te gebruiken.

Bijvoorbeeld:

```ts
imageUrl: '/images/product1/step-01.png'
```

Dat maakt onderhoud veel eenvoudiger.

---

# 19. Registratie van tijden per stap

De website registreert hoe lang bepaalde stappen duren.

Er zijn twee categorieën:

```text
Voorbereiding
Montage
```

Data worden opgeslagen als:

```ts
StepLogEntry
```

met:

```text
phase
product
step
startTime
stopTime
durationMs
```

De omstelstappen die geregistreerd worden zijn:

```text
Werkpost vrijmaken
Mal plaatsen
Onderdelen controleren
Gereedschap controleren
Omstelling afronden
```

Daarnaast registreert `ProductionStepsScreen` de duur van elke montagestap.

Deze gegevens kunnen gebruikt worden voor de SMED-analyse.

---

# 20. Instellingen Operator

Bestand:

```text
src/components/SettingsScreen.tsx
```

Vanuit de Operator-interface kan het instellingenmenu geopend worden.

Hier kan onder andere:

- operatornaam aangepast worden;
- lijn aangepast worden;
- werkpost aangepast worden;
- shift aangepast worden;
- een probleem gemeld worden;
- een bericht naar de teamleader gestuurd worden;
- een belverzoek naar de teamleader gestuurd worden;
- geplande omstellingen bekeken worden;
- de stapregistratie als CSV gedownload worden.

De Operator kan vanuit dit scherm **geen nieuwe omstelling plannen**.

Dat gebeurt uitsluitend via de Manager-interface.

---

# 21. Problemen en berichten naar de Manager

De Operator kan vanuit Settings meldingen versturen.

Die gaan via:

```text
sirris-mfg-demo-k7q2x9-events
```

Mogelijke types zijn onder andere:

```text
incident
message
call_request
```

De Manager-interface luistert naar dit kanaal en toont de berichten in:

```text
Meldingen & berichten (live)
```

---

# 22. Eindcontrole van het product

Na de laatste montagestap gaat de Operator naar:

```text
final-qc
```

Component:

```text
src/components/FinalQCScreen.tsx
```

De tablet wacht hier op een productcontrole van de Camera-interface.

Belangrijk:

```text
context moet final-qc zijn
product moet overeenkomen met het huidige toProduct
```

---

# 23. Huidige status van de productcontrole

De productcontrole is op dit moment nog **geen volwaardige computer-visioncontrole**.

Dit is belangrijk om te weten bij verdere ontwikkeling.

In `CameraApp()` wordt bij de productcontrole:

1. de camera geopend;
2. een foto genomen;
3. ongeveer twee seconden een analyse-animatie getoond;
4. automatisch een `OK`-resultaat gepubliceerd.

De functie heet:

```ts
fakeAnalyseProduct()
```

Deze staat in:

```text
src/main.tsx
```

De productcontrole is dus momenteel vooral bedoeld om de volledige workflow te demonstreren.

De infrastructuur voor:

```text
foto → analyse → resultaat terug naar Operator
```

werkt wel.

De echte beeldanalyse kan later op deze plaats worden toegevoegd.

---

# 24. Overgebleven koppeling voor externe QC

In `src/main.tsx` staat ook nog een listener voor:

```text
sirris-final-qc-result
```

via:

```ts
window.addEventListener('message', ...)
```

Deze code was bedoeld om een aparte externe QC-app een resultaat te laten terugsturen via `postMessage`.

Er staat momenteel **geen actieve iframe-URL naar LeafyNeedyPercent** in deze repository.

Dus:

```text
LeafyNeedyPercent
```

is momenteel geen noodzakelijk onderdeel van de huidige werkende flow.

De listener kan wel nuttig zijn als later opnieuw een externe vision-app gekoppeld wordt.

Als deze koppeling niet meer gewenst is, kan dit blok later uit `main.tsx` verwijderd worden.

---

# 25. Wat gebeurt er na een OK eindcontrole?

Bij `OK`:

```text
finalQCPassed = true
producedCount + 1
```

Daarna gaat de Operator naar:

```text
deliver-product
```

Component:

```text
src/components/DeliverProductScreen.tsx
```

Momenteel staat als voorbeeldlocatie:

```text
Zone A
Rek 02
Niveau 1
```

Dit zijn demo-/placeholdergegevens.

Daarna komt het `finish`-scherm.

---

# 26. Wat gebeurt er na een NOK eindcontrole?

Bij `NOK` wordt:

```text
firstTimeRight = false
```

en gaat de Operator naar:

```text
reject-product
```

Component:

```text
src/components/RejectProductScreen.tsx
```

Daar wordt aangegeven dat het afgekeurde product naar de afkeurzone moet.

Momenteel:

```text
Zone D
Rek Afkeur
```

Daarna start de Operator opnieuw een exemplaar van hetzelfde product.

Een afgekeurd product telt niet mee in:

```text
producedCount
```

---

# 27. Finish-scherm en CSV-export

Component:

```text
src/components/FinishScreen.tsx
```

Dit scherm geeft een samenvatting van de cyclus.

Onder andere:

```text
Product
Totale tijd
Begeleide omsteltijd
Montagetijd
Resultaat eindcontrole
First-Time-Right
Operator
Lijn
Werkpost
```

Er kan een CSV-bestand gedownload worden.

Daarnaast kan vanuit Settings ook een aparte CSV met de stapregistraties gedownload worden.

---

# 28. Volgende productcyclus

Na het Finish-scherm controleert de website of er een geplande omstelling klaarstaat.

Als er een omstelling is waarvan:

```text
fromProduct = het product dat net afgewerkt werd
```

dan wordt die omstelling gestart.

Als er geen nieuwe omstelling nodig is, gaat de Operator rechtstreeks opnieuw naar productie van hetzelfde product.

De malcontrole hoeft dan niet opnieuw te gebeuren.

Dit is bewust: zolang hetzelfde product geproduceerd blijft worden, blijft de bestaande mal geldig.

---

# 29. Manager-interface

De Manager-interface zit in:

```text
src/main.tsx
```

Functie:

```ts
ManagerApp()
```

De Manager-interface heeft drie belangrijke functies:

1. live status bekijken;
2. kwaliteitsresultaten en meldingen bekijken;
3. nieuwe omstellingen plannen.

---

# 30. Live status bij de Manager

De Operator stuurt bij elke belangrijke stap een statusbericht.

Voorbeeld:

```json
{
  "source": "operator",
  "currentStep": "production",
  "fromProduct": "Product 1",
  "toProduct": "Product 2",
  "operatorName": "...",
  "line": "Lijn 4",
  "station": "Stat. 2"
}
```

De Manager groepeert Operator-statussen per:

```text
lijn + werkpost
```

Daardoor kunnen in principe meerdere operatorwerkposten tegelijk weergegeven worden.

De Waterspider stuurt ook zijn huidige scherm/status naar hetzelfde kanaal.

---

# 31. Omstelling plannen via Manager

De Manager kan instellen:

```text
Van product
Naar product
Werkpost
Aantal stuks
Wanneer
```

Er zijn drie triggers:

```text
Nu
Na huidig product
Op datum/tijd
```

In de code:

```ts
type ChangeoverTrigger =
  | 'scheduled'
  | 'after-current-product'
  | 'now';
```

## Nu

`now` wordt onmiddellijk naar de Operator gestuurd.

De huidige Operator-flow wordt dan onderbroken en de nieuwe productwissel wordt gestart.

## Na huidig product

De omstelling wordt in de wachtrij gezet en start wanneer het huidige product klaar is.

## Op datum/tijd

De datum en tijd worden opgeslagen en getoond.

### Belangrijk

Er zit momenteel **geen echte kloklogica in die op het ingestelde tijdstip automatisch start**.

De geplande opdracht wordt in de wachtrij gezet en wordt verwerkt bij het afronden van een productcyclus.

De datum/tijd is in deze prototypeversie dus vooral informatief.

Als echte tijdgestuurde planning gewenst is, moet hiervoor extra logica toegevoegd worden.

---

# 32. Kwaliteitslog Manager

De Manager luistert naar alle Camera/QC-resultaten.

Per Product 1 en Product 2 worden apart geteld:

```text
Malcontrole OK
Malcontrole NOK
Eindcontrole OK
Eindcontrole NOK
```

Daarnaast toont de Manager de laatste individuele resultaten.

De log houdt maximaal ongeveer 30 recente resultaten bij.

---

# 33. Manager-data lokaal bewaren

Manager-data worden lokaal bewaard onder:

```text
sirris_manager_state_v1
```

Onder andere:

```text
operatorStatuses
waterspiderStatus
qualityLog
eventsLog
plannedChangeoverLog
```

Een refresh wist deze data dus niet onmiddellijk.

Teruggaan naar het startscherm via de Manager-interface verwijdert deze lokale Manager-state.

---

# 34. Waterspider-interface

De Waterspider-interface zit in:

```text
src/main.tsx
```

Functie:

```ts
WaterspiderApp()
```

De interface is bewust compact gemaakt voor een klein mobiel toestel / polstablet.

De flow is:

```text
werkpost kiezen
→ lege bakken?
→ QR-codes scannen
→ profielen tellen
→ ophaallijst
→ aanvullen
→ werkpost klaar
```

---

# 35. Werkposten Waterspider

Momenteel zijn vier werkposten hardcoded:

```text
Werkpost 1
Werkpost 2
Werkpost 3
Werkpost 4
```

Allemaal:

```text
Lijn 4
```

Deze staan in:

```ts
ROUTE_STATIONS
```

Als later andere werkposten gebruikt worden, moet deze array aangepast worden.

---

# 36. Waterspider ontvangt geplande omstellingen

De Waterspider luistert naar hetzelfde changeover-kanaal als de Operator.

Wanneer de Manager een omstelling plant, verschijnt bij de relevante werkpost bijvoorbeeld:

```text
Product 1 → Product 2
```

Dit helpt de Waterspider om te zien voor welke werkpost voorbereiding nodig is.

---

# 37. Lege bakken en QR-scanner

Bij een gekozen werkpost krijgt de Waterspider de vraag:

```text
Zijn er lege bakken?
```

Bij `JA` wordt de QR-scanner geopend.

De scanner gebruikt indien beschikbaar:

```text
BarcodeDetector
```

van de browser.

Als BarcodeDetector niet beschikbaar is, is er onderaan een kleine handmatige fallback waar een code ingevoerd kan worden.

Voorbeeld:

```text
BIN-M3
```

Elke QR-code mag per werkpostbezoek maximaal één keer gescand worden.

---

# 38. Huidige QR-database

De QR-codes zijn hardcoded in:

```ts
BIN_DATABASE
```

Momenteel staan daar onder andere:

```text
BIN-M3
BIN-M4
BIN-M5
BIN-TNUT-M3
BIN-TNUT-M4
BIN-NUTENSTEIN-LONG
BIN-HANDLE
```

Per code staat:

```text
materiaal
ophaallocatie
locatie aan de werkpost
```

Bijvoorbeeld:

```text
Supermarkt A1
Poka-yoke kast · B1
```

### Belangrijk

Deze database bevat nog enkele demo-inconsistenties.

Bijvoorbeeld:

```text
BIN-M4 → materiaal staat momenteel als "M3 bouten"
BIN-TNUT-M4 → materiaal staat momenteel als "T-moeren M5"
```

Controleer en corrigeer deze waarden voordat de QR-flow als definitieve materiaalreferentie gebruikt wordt.

---

# 39. Profielvoorraad Waterspider

Na de bakken telt de Waterspider de profielen.

Huidige doelvoorraad:

```text
Profiel 370 mm      doel 4
Profiel 630 mm      doel 4
Profiel 370×60 mm   doel 2
```

Deze staan in:

```ts
PROFILE_STOCK
```

Per profiel vult de Waterspider in hoeveel er aanwezig zijn.

De website berekent automatisch:

```text
tekort = doel - aanwezig
```

Voorbeeld:

```text
Doel: 4
Aanwezig: 2

→ 2 bijhalen
```

---

# 40. Automatische ophaallijst

Op basis van:

- gescande lege bakken;
- getelde profielvoorraad;

wordt automatisch een ophaallijst gemaakt.

De ophaallijst vermeldt:

```text
wat moet opgehaald worden
hoeveel
waar het ligt
```

De Waterspider vinkt elk item af.

Pas wanneer alles opgehaald is kan verder gegaan worden.

---

# 41. Aanvullen aan de werkpost

Na de ophaallijst toont de website waar elk item aan de werkpost moet worden aangevuld.

Bijvoorbeeld:

```text
Poka-yoke kast · B1
Profielvoorraad aan de lijn
```

Wanneer alle items zijn aangevuld kan:

```text
WERKPOST KLAAR
```

worden gekozen.

Daarna keert de Waterspider terug naar het overzicht van de vier werkposten.

---

# 42. Waterspider-data lokaal bewaren

De Waterspider-flow wordt lokaal opgeslagen onder:

```text
sirris_waterspider_milkrun_v4
```

Daarin zit onder andere:

```text
huidig scherm
werkpost
fase
gescande bakken
profieltellingen
afgevinkte ophaalitems
afgevinkte aanvulitems
geplande omstellingen
```

Bij refresh blijft de toestand daardoor grotendeels behouden.

---

# 43. Communicatie via ntfy

De applicatie gebruikt één basistopic:

```text
sirris-mfg-demo-k7q2x9
```

Daaruit worden meerdere topics afgeleid.

## QC-resultaten

```text
sirris-mfg-demo-k7q2x9
```

## Live status

```text
sirris-mfg-demo-k7q2x9-status
```

## Omstellingen

```text
sirris-mfg-demo-k7q2x9-changeover
```

## Meldingen

```text
sirris-mfg-demo-k7q2x9-events
```

De constants staan bovenaan in:

```text
src/main.tsx
```

### Belangrijk

`ntfy.sh` is in deze versie publiek.

Iedereen die de topicnaam kent kan in theorie berichten lezen of versturen.

Dit is prima voor een demonstrator, maar niet voor echte productie.

Voor verder onderzoek zou een eigen backend of beveiligd messaging-systeem een logische volgende stap zijn.

---

# 44. LocalStorage en SessionStorage

De website gebruikt lokale browseropslag om refreshes beter op te vangen.

Belangrijkste keys:

```text
sirris_operator_state_v1
sirris_manager_state_v1
sirris_waterspider_milkrun_v4
camera_check_result
```

Session storage:

```text
sirris_unlocked_modes
sirris_app_mode
```

Als browserdata worden gewist, worden deze lokale statussen ook verwijderd.

Dit is dus geen centrale database.

Twee verschillende toestellen delen `localStorage` niet met elkaar.

Daarom wordt voor communicatie tussen echte aparte toestellen `ntfy.sh` gebruikt.

---

# 45. Belangrijke bestanden

## Hoofdlogica

```text
src/main.tsx
```

Hierin zitten:

- startscherm;
- PIN-logica;
- OperatorApp;
- CameraApp;
- ManagerApp;
- WaterspiderApp;
- ntfy-topics;
- centrale workflow;
- camerakleurdetectie.

## Operator-schermen

```text
src/components/
```

Belangrijke bestanden:

```text
MainDashboardScreen.tsx
ChangeoverCommandScreen.tsx
RemoveProduct1Screen.tsx
ChangeoverStep1Screen.tsx
ChangeoverStep2Screen.tsx
ChangeoverStep3Screen.tsx
ChangeoverStep4Screen.tsx
ChangeoverStep5Screen.tsx
CameraCheckScreen.tsx
ProductionStepsScreen.tsx
FinalQCScreen.tsx
DeliverProductScreen.tsx
RejectProductScreen.tsx
FinishScreen.tsx
SettingsScreen.tsx
```

---

# 46. Waar aanpassen als Product 1 of Product 2 verandert?

Controleer minstens:

```text
ProductionStepsScreen.tsx
ChangeoverStep2Screen.tsx
ChangeoverStep3Screen.tsx
ChangeoverStep4Screen.tsx
ChangeoverStep5Screen.tsx
CameraApp in main.tsx
Waterspider BIN_DATABASE
Waterspider PROFILE_STOCK
```

Daarnaast moeten de gebruikte afbeeldingen aangepast worden als de fysieke montage verandert.

---

# 47. Waar aanpassen als een materiaalbak verandert?

Ga naar:

```text
src/main.tsx
```

Zoek:

```ts
BIN_DATABASE
```

Pas aan:

```text
qrCode
material
pickupLocation
stationLocation
```

---

# 48. Waar aanpassen als profielvoorraad verandert?

Ga naar:

```text
src/main.tsx
```

Zoek:

```ts
PROFILE_STOCK
```

Per profiel kan aangepast worden:

```text
naam
doelhoeveelheid
ophaallocatie
```

---

# 49. Waar aanpassen als er meer werkposten komen?

Ga naar:

```text
src/main.tsx
```

Zoek:

```ts
ROUTE_STATIONS
```

Voeg hier werkposten toe of wijzig namen.

Let op: de huidige Waterspider-interface is visueel ontworpen voor vier werkposten in een 2×2 raster.

Bij meer dan vier werkposten moet waarschijnlijk ook de layout aangepast worden.

---

# 50. Waar montage-instructies aanpassen?

Ga naar:

```text
src/components/ProductionStepsScreen.tsx
```

Zoek:

```ts
PRODUCT1_STEPS
PRODUCT2_STEPS
```

Elke stap bevat bijvoorbeeld:

```ts
{
  id: 6,
  title: "Bevestig de profielstructuur",
  instruction: "...",
  imageUrl: ...,
  requiresTool: true,
  toolName: "M3 inbussleutel"
}
```

---

# 51. Waar de omstelchecklists aanpassen?

Gebruik:

```text
ChangeoverStep1Screen.tsx
ChangeoverStep2Screen.tsx
ChangeoverStep3Screen.tsx
ChangeoverStep4Screen.tsx
ChangeoverStep5Screen.tsx
```

Deze checklists zijn momenteel vooral hardcoded.

Voor een volgende versie zou het beter zijn om alle productspecifieke gegevens in één centrale configuratie te zetten.

Bijvoorbeeld:

```text
src/config/products.ts
```

Dat bestaat momenteel nog niet.

---

# 52. Huidige beperkingen / zaken die nog niet volledig afgewerkt zijn

De belangrijkste punten om rekening mee te houden:

1. **Producteindcontrole is momenteel gesimuleerd.**  
   De Camera geeft na ongeveer twee seconden automatisch OK.

2. **Een oude `postMessage`-hook voor externe vision bestaat nog**, maar er wordt momenteel geen LeafyNeedyPercent-iframe geopend.

3. **Omstelschermen 2–5 bevatten nog Product 2-specifieke teksten.**

4. **Geplande datum/tijd is nog geen echte tijdgestuurde planning.**

5. **Materiaaldata van de Waterspider bevatten nog enkele foutieve labels.**

6. **Opslag is lokaal in de browser**, geen centrale database.

7. **ntfy-topics zijn publiek** en niet geschikt als definitieve industriële communicatie.

8. **Een aantal afbeeldingen en locaties zijn placeholders/demodata.**

9. **Product1ApprovedScreen gebruikt nog een algemene externe voorbeeldafbeelding.**

10. **Deliver- en Reject-locaties zijn demo-instellingen.**

Dit zijn geen blockers voor de huidige demonstrator, maar wel de eerste zaken die ik zou bekijken bij verdere ontwikkeling.

---

# 53. Testen na een wijziging

Na een grotere codewijziging zou ik altijd minimaal deze volledige keten testen.

## Operator / Manager

1. Open Manager.
2. Open Operator.
3. Plan via Manager een wissel Product 1 → Product 2.
4. Controleer of de opdracht bij Operator binnenkomt.
5. Start de omstelling.
6. Doorloop stap 1.
7. Doorloop stap 2.
8. Controleer of Camera automatisch naar malcontrole springt.
9. Test een OK-resultaat.
10. Controleer dat Operator naar stap 3 gaat.
11. Rond omstelling af.
12. Start productie.
13. Doorloop alle montage-instructies.
14. Controleer of Operator naar eindcontrole gaat.
15. Controleer dat Camera naar productcontrole springt.
16. Neem foto.
17. Controleer of het resultaat terugkomt op Operator.
18. Rond afleveren en Finish af.
19. Controleer of producedCount +1 is.

## NOK-flow

Daarnaast minstens:

```text
malcontrole NOK
eindcontrole NOK
```

testen.

Bij mal NOK moet de Operator terug kunnen corrigeren.

Bij eindcontrole NOK moet het product naar de afkeurflow gaan en mag de productieteller niet stijgen.

## Waterspider

Test:

1. geplande omstelling zichtbaar;
2. werkpost selecteren;
3. lege bak scannen;
4. dubbele QR-code wordt geweigerd;
5. profieltekort invoeren;
6. ophaallijst correct;
7. aanvullen correct;
8. werkpost afronden.

---

# 54. Gebruikte technologie

Belangrijkste packages:

```text
React 18
TypeScript
Vite
Tailwind CSS
Lucide React
```

Er is geen aparte backend in deze repository.

---

# 55. Suggestie voor verdere ontwikkeling

Als deze demonstrator later verder wordt onderzocht, zou ik technisch ongeveer in deze volgorde werken:

1. productspecifieke data uit de schermen halen en centraliseren;
2. Product 1 ↔ Product 2 volledig symmetrisch maken;
3. echte product-QC koppelen;
4. lokale opslag vervangen of aanvullen met centrale opslag;
5. ntfy vervangen door beveiligde communicatie;
6. planning echt tijdgestuurd maken;
7. logging centraal opslaan;
8. afbeeldingen uit de TypeScript-bestanden halen;
9. materiaal- en werkpostconfiguratie beheerbaar maken zonder codewijziging;
10. gebruikersbeheer toevoegen.

---

# 56. Samengevat

De huidige website is vooral een functionele demonstrator van hoe een digitale werkpost de verschillende rollen rond een SMED-omstelling kan verbinden.

De sterkste onderdelen die al aanwezig zijn:

- aparte interfaces per rol;
- volledige Operator-flow;
- Product 1 en Product 2 montage-instructies;
- automatische communicatie tussen Operator en Camera;
- automatische malcontrole via kleurdetectie;
- Managerplanning;
- live Managerstatus;
- live kwaliteitslog;
- Waterspider QR- en voorraadflow;
- automatische ophaallijst;
- tijdregistratie per stap;
- CSV-export;
- herstel van lokale state na refresh.

De belangrijkste nog experimentele onderdelen zijn:

- echte eindcontrole van het afgewerkte product;
- volledige bidirectionele productspecifieke omstelschermen;
- industriële communicatie en opslag;
- echte tijdgestuurde planning.

Voor de huidige stage-demonstrator is de flow voldoende bruikbaar om het concept te tonen en verder te onderzoeken.

---

## Project

Ontwikkeld tijdens stage bij Sirris.

**Florine De Spiegeleer**  
UGent – Industrieel Ontwerpen  
2026