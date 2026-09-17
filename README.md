# Digital Workstation

Deze repository bevat de code van het Digital Workstation dat tijdens mijn stage bij Sirris werd ontwikkeld.

Het systeem ondersteunt de omstelling tussen Product 1 en Product 2 en bestaat uit verschillende schermen voor de Manager, Waterspider, Operator en Camera/QC.

Live versie:  
https://florinedespiegeleer.github.io/DigitalWorkstation/

---

## Waarvoor dient dit?

Het doel van het Digital Workstation is om de omstelling en montage stap voor stap te ondersteunen.

De belangrijkste functies zijn:

- een productwissel starten;
- de Waterspider laten voorbereiden;
- de Operator door de omstelling leiden;
- de juiste mal controleren met de camera;
- montage-instructies tonen;
- op het einde een kwaliteitscontrole uitvoeren;
- OK/NOK-resultaten terugsturen naar de Operator.

---

## Belangrijkste schermen

### Manager
Hier wordt de productwissel gestart.

De Manager kiest naar welk product er wordt omgesteld en kan de voortgang volgen.

### Waterspider
Hier staan de voorbereidende taken.

Voorbeelden:
- onderdelen klaarzetten;
- profielen tellen;
- bakken aanvullen;
- gereedschap klaarleggen;
- juiste mal voorbereiden.

### Operator
Dit is het hoofdscherm tijdens de omstelling en montage.

De Operator krijgt:
- omstelstappen;
- checklists;
- montage-instructies;
- cameraresultaten;
- eindcontrole.

### Camera / QC
De camera wordt gebruikt voor:
1. controle van de mal;
2. eindcontrole van het product.

---

## Product 1 en Product 2

De website bevat aparte instructies en controles voor Product 1 en Product 2.

Wanneer hier later iets aan wordt aangepast, controleer altijd of ook deze onderdelen nog kloppen:

- werkinstructies;
- onderdelenlijst;
- gereedschappen;
- mal;
- cameracontrole;
- eindcontrole.

---

## Communicatie tussen de schermen

De verschillende schermen sturen statusupdates naar elkaar.

Hiervoor wordt in het prototype onder andere `ntfy` gebruikt.

Het gebruikte topic staat in de code als:

```text
sirris-mfg-demo-k7q2x9
```

Als dit topic wordt aangepast, moet dezelfde waarde gebruikt worden op alle plaatsen waar de communicatie gebeurt.

Sommige gegevens worden ook lokaal in de browser opgeslagen met `localStorage`.

Dit betekent dat gegevens kunnen verdwijnen wanneer browserdata worden gewist.

---

## Camera-controle

Er zijn twee cameracontroles.

### 1. Malcontrole
Na het plaatsen van de nieuwe mal wordt de Camera-pagina automatisch geopend.

De camera geeft:
- `OK` wanneer de opstelling correct is;
- `NOK` wanneer de opstelling niet correct is.

Bij NOK moet de fout eerst worden aangepast voor de Operator verdergaat.

### 2. Eindcontrole
Na de montage wordt de eindcontrole geopend.

De cameratoepassing voor deze controle staat apart in de repository/projectomgeving van:

```text
LeafyNeedyPercent
```

De Digital Workstation-pagina opent deze controle in een ingebed venster.

Na de controle wordt het resultaat teruggestuurd naar het Operator-scherm.

---

## Koppeling met LeafyNeedyPercent

De eindcontrole wordt geopend met een URL in deze vorm:

```text
/LeafyNeedyPercent/?embed=1&product=product1
```

of:

```text
/LeafyNeedyPercent/?embed=1&product=product2
```

Het geselecteerde product wordt dus automatisch meegegeven.

Na de controle stuurt LeafyNeedyPercent een resultaat terug naar het Digital Workstation via `postMessage`.

Wanneer één van beide websites later wordt aangepast, controleer dan zeker of deze koppeling nog werkt.

---

## Referentiebeelden voor de eindcontrole

De referentiebeelden worden lokaal opgeslagen in de browser.

De gebruikte keys zijn:

```text
sirris-overlay-reference-product1-v1
sirris-overlay-reference-product2-v1
```

Referenties kunnen ingesteld worden via de setup-pagina van LeafyNeedyPercent.

```text
https://florinedespiegeleer.github.io/LeafyNeedyPercent/?setup=1
```

Admin PIN:

```text
9999
```

Na grote wijzigingen aan een product, camera-opstelling of referentievlak moeten de referentiebeelden opnieuw worden gemaakt.

---

## AprilTags

Voor de eindcontrole worden vier AprilTags gebruikt.

De gebruikte IDs zijn:

```text
0 = linksboven
1 = rechtsboven
2 = linksonder
3 = rechtsonder
```

Deze tags bepalen het referentievlak voor de cameracontrole.

Als één tag ontbreekt of slecht zichtbaar is, kan de controle niet correct uitgevoerd worden.

---

## Waar moet je op letten bij aanpassingen?

Wanneer iemand na mijn stage aan de code verderwerkt, zijn dit de belangrijkste dingen om te controleren:

### Bij wijzigingen aan de workflow
Controleer altijd:
- Manager;
- Waterspider;
- Operator;
- automatische overgang naar Camera;
- terugkoppeling OK/NOK.

### Bij wijzigingen aan Product 1 of Product 2
Controleer:
- onderdelen;
- montagevolgorde;
- checklist;
- mal;
- camera-instellingen;
- referentiebeeld.

### Bij wijzigingen aan de camera
Test altijd minstens:
- correcte mal;
- verkeerde mal;
- correct product;
- fout product;
- ontbrekende AprilTag;
- product op een andere positie.

---

## Als iets niet meer werkt

### Schermen reageren niet op elkaar
Controleer:
1. internetverbinding;
2. of `ntfy` nog bereikbaar is;
3. of overal hetzelfde topic gebruikt wordt;
4. browser opnieuw laden.

### Camera opent niet
Controleer:
1. cameratoestemming in de browser;
2. of de camera niet door een andere app gebruikt wordt;
3. pagina opnieuw laden.

### Cameraresultaat komt niet terug bij de Operator
Controleer:
1. of LeafyNeedyPercent correct in het iframe opent;
2. of het juiste product in de URL staat;
3. `postMessage`-koppeling;
4. browserconsole op fouten.

### Referentiebeeld verdwenen
Browserdata zijn mogelijk gewist.

Maak het referentiebeeld opnieuw via:

```text
https://florinedespiegeleer.github.io/LeafyNeedyPercent/?setup=1
```

---

## Testen na een wijziging

Na een grotere aanpassing zou ik altijd deze korte test uitvoeren:

1. Start een productwissel via Manager.
2. Controleer of Waterspider de juiste taak krijgt.
3. Controleer of Operator de juiste productwissel krijgt.
4. Doorloop de omstelling.
5. Controleer of de malcontrole automatisch opent.
6. Test één keer OK en één keer NOK.
7. Start productie.
8. Doorloop de montage.
9. Controleer of de eindcontrole opent.
10. Controleer of het resultaat terugkomt bij Operator.

Als deze volledige flow werkt, is de koppeling tussen de verschillende onderdelen normaal in orde.

---

## Huidige status

Dit is een prototype en geen volledig industrieel softwaresysteem.

Een aantal zaken zijn bewust eenvoudig gehouden, bijvoorbeeld:

- lokale browseropslag;
- geen gebruikersaccounts;
- geen centrale database;
- geen MES/ERP-koppeling;
- camera-inspectie is een demonstrator en geen gevalideerd industrieel meetsysteem.

De code is vooral bedoeld om het concept en de workflow te demonstreren en om later verder op voort te bouwen.

---

## Mogelijke verdere uitwerking

Als Sirris hier later op verderwerkt, zijn mogelijke uitbreidingen:

- centrale opslag van resultaten;
- gebruikersaccounts;
- logging van omsteltijden;
- opslaan van NOK-redenen;
- koppeling met barcode/QR;
- koppeling met MES/ERP;
- robuustere cameracontrole;
- beheerpagina voor producten en instructies;
- automatische versiecontrole van werkinstructies.

---

## Project

Ontwikkeld tijdens stage bij Sirris.

**Florine De Spiegeleer**  
UGent – Industrieel Ontwerpen  
2026
