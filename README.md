# Digital Workstation

Browsergebaseerd productieondersteunend systeem voor productwissels, montagebegeleiding en kwaliteitscontrole.

**Projectstatus:** Functioneel prototype / demonstrator  
**Toepassing:** Digitale ondersteuning voor SMED-gebaseerde omstellingen en assemblage  
**Live prototype:** https://florinedespiegeleer.github.io/DigitalWorkstation/

---

## 1. Overzicht

Het **Digital Workstation** ondersteunt operatoren en ondersteunende productierollen tijdens productwissels en assemblagehandelingen.

Het systeem werd ontwikkeld om zoeken, wachten, variatie tijdens omstellingen en montagefouten te verminderen door middel van:

- rolgebaseerde digitale workflows;
- externe voorbereiding door een Waterspider;
- begeleide omstelinstructies;
- productspecifieke montage-instructies;
- controle van de mal;
- eindcontrole van het afgewerkte product;
- communicatie tussen verschillende toestellen;
- gestandaardiseerd werk en SMED-principes.

Het huidige prototype ondersteunt **Product 1** en **Product 2**.

> **Belangrijk:** Het Digital Workstation is een productieondersteunend prototype. Het vervangt geen mechanische veiligheidssystemen, koppelcontrole of gekwalificeerde inspectie van veiligheidskritische assemblages.

---

## 2. Systeem in één oogopslag

Het systeem bestaat uit vier hoofdinterfaces.

| Interface | Doel |
|---|---|
| **Manager** | Start een productwissel en volgt de voortgang. |
| **Waterspider** | Bereidt materialen, gereedschappen, documentatie en de juiste mal voor vóór de interne omstelling start. |
| **Operator** | Voert de omstelling en montage uit aan de hand van digitale werkinstructies. |
| **Camera / Quality Control** | Voert de controle van de mal en de eindcontrole van het product uit. |

### Typische workflow

```text
Manager
  |
  v
Start productwissel
  |
  v
Waterspider
Bereid materialen, gereedschappen, mal en documentatie voor
  |
  v
Operator
Start interne omstelling
  |
  v
Camera / QC
Controle van de mal
  |
  +---- NOK --> Corrigeer opstelling --> Opnieuw controleren
  |
  v
Operator
Start productie en volg montage-instructies
  |
  v
Camera / QC
Eindcontrole product
  |
  +---- NOK --> Corrigeer product --> Opnieuw controleren
  |
  v
Product vrijgegeven
```

---

## 3. Aan de slag

### Vereisten voor het prototype

Aanbevolen hardware:

- pc of tablet voor de Manager;
- tablet of mobiel toestel voor de Waterspider;
- tablet in liggende stand voor de Operator;
- smartphone of toestel met camera voor Quality Control;
- netwerk- / internetverbinding;
- moderne browser met JavaScript ingeschakeld.

### Eerste ingebruikname

1. Open het Digital Workstation op de vereiste toestellen.
2. Ken de juiste interface toe aan elke rol.
3. Open de Camera / QC-interface op het cameratoestel.
4. Geef cameratoegang wanneer de browser daarom vraagt.
5. Controleer of alle toestellen netwerktoegang hebben.
6. Controleer de actieve productconfiguratie.
7. Controleer of de juiste productreferenties beschikbaar zijn.
8. Voer één communicatietest tussen de interfaces uit.
9. Voer één test van de malcontrole uit.
10. Voer één eindcontrole uit vóór het systeem wordt gebruikt voor een demonstratie of validatietest.

---

## 4. Rollen en verantwoordelijkheden

### Manager

De Manager start de wissel van het huidige product naar het volgende gewenste product.

Belangrijkste functies:

- het volgende product selecteren;
- de productwissel starten;
- de status van voorbereiding en omstelling opvolgen;
- de voortgang van de workflow monitoren.

### Waterspider

De Waterspider voert de **externe omstelactiviteiten** uit vóór de Operator de interne omstelling start.

Typische taken:

- benodigde componenten voorbereiden;
- onderdelenbakken aanvullen;
- aluminiumprofielen voorbereiden;
- het juiste gereedschap klaarleggen;
- de juiste mal voorbereiden;
- productdocumentatie klaarleggen;
- bevestigen dat de werkpost klaar is.

Het doel is ervoor te zorgen dat de Operator tijdens de interne omstelling geen materiaal of gereedschap meer moet zoeken.

### Operator

De Operator-interface begeleidt de productiemedewerker door:

1. het afronden van de huidige productie;
2. het starten van de omstelling;
3. het verwijderen van de vorige opstelling;
4. het plaatsen van de nieuwe mal;
5. de kwaliteitscontrole van de mal;
6. de controle van componenten en gereedschappen;
7. het starten van de productie;
8. stap-voor-stap montage;
9. de eindcontrole van het product;
10. het afronden van het product.

### Administrator

Administratieve functies zijn bedoeld voor configuratie en onderhoud van het systeem.

Typische administratieve functies:

- productspecifieke referenties instellen;
- kwaliteitscontrole configureren;
- referentiebeelden vervangen;
- productspecifieke gegevens onderhouden;
- prototype-instellingen beheren.

---

## 5. Productconfiguratie

Het huidige prototype ondersteunt twee productvarianten.

| Configuratie-item | Product 1 | Product 2 |
|---|---|---|
| Productspecifieke mal | Mal P1 | Mal P2 |
| Werkinstructies | Instructies P1 | Instructies P2 |
| Technische documentatie | Documentatie P1 | Documentatie P2 |
| Referentie eindcontrole | Referentie P1 | Referentie P2 |
| Onderdelenchecklist | Productspecifiek | Productspecifiek |

Voor elk product moeten dus de juiste mal, instructies, technische tekening, onderdelenlijst en QC-referentie beschikbaar zijn.

---

## 6. Productieworkflow

### Fase 1 — Productwissel aangevraagd

De Manager selecteert het gewenste volgende product.

Voorbeeld:

```text
Product 1 -> Product 2
```

Daarna worden de vereiste voorbereidende activiteiten gestart.

### Fase 2 — Externe voorbereiding

De Waterspider bereidt de werkpost voor terwijl het vorige product eventueel nog in productie is.

Dit omvat, indien van toepassing:

- onderdelenkits;
- aluminiumprofielen;
- bevestigingsmaterialen;
- gereedschappen;
- mal;
- werkinstructies;
- technische tekeningen;
- labels.

Wanneer de voorbereiding volledig is, wordt de werkpost als klaar gemarkeerd.

### Fase 3 — Interne omstelling

Nadat het laatste product van de huidige serie is afgewerkt, start de Operator de interne omstelling.

Typische handelingen:

- de vorige opstelling verwijderen;
- de nieuwe mal plaatsen;
- de mal controleren;
- voorbereide componenten bevestigen;
- voorbereide gereedschappen controleren.

### Fase 4 — Productie

Na een succesvolle malcontrole kan de Operator de productie starten.

De Operator volgt vervolgens de productspecifieke digitale montage-instructies.

### Fase 5 — Eindcontrole

Na de assemblage wordt het product gecontroleerd vóór vrijgave.

Een verplichte **NOK**-melding moet eerst worden gecorrigeerd voordat de workflow verdergaat.

---

## 7. Kwaliteitscontrole

Het systeem gebruikt twee afzonderlijke kwaliteitscontrolemomenten.

### 7.1 Malcontrole

**Doel:** Controleren of de juiste mal / opstelling is geplaatst vóór de productie start.

**Input:** Camerabeeld van de mal op de werkpost.

**Output:**

- `OK` — de workflow mag verdergaan;
- `NOK` — de opstelling moet worden gecorrigeerd en opnieuw gecontroleerd.

### 7.2 Eindcontrole product

**Doel:** De controle van het afgewerkte product ondersteunen na de montage.

Afhankelijk van de actieve prototypeconfiguratie kan het systeem zichtbare productkenmerken evalueren, zoals:

- verwachte productgeometrie;
- aanwezigheid van componenten;
- positie van de wielen;
- productspecifieke visuele referentie;
- algemene montageconfiguratie.

**Output:**

- `OK` — het product kan worden vrijgegeven;
- `NOK` — het product moet worden gecorrigeerd en opnieuw gecontroleerd.

### Beperkingen van de QC

De camera controleert **niet**:

- het aandraaimoment van bouten;
- verborgen aangrijping van bevestigingen;
- interne materiaalfouten;
- structurele sterkte;
- verborgen schade;
- mechanische veiligheidsconformiteit.

Waar nodig moeten hiervoor afzonderlijke controles worden voorzien.

---

## 8. Systeemarchitectuur

Het prototype gebruikt een lichte browsergebaseerde architectuur.

Belangrijkste mechanismen:

- **GitHub Pages** voor hosting van het prototype;
- **browser localStorage** voor bepaalde lokale statusinformatie en referentiegegevens;
- **ntfy** voor event- en statuscommunicatie tussen interfaces;
- een **ingebedde QC-interface** voor de eindcontrole;
- browser **postMessage**-communicatie voor het doorgeven van QC-resultaten.

Conceptueel:

```text
Manager
   |
   | aanvraag productwissel
   v
Digital Workstation
   |
   +---- voorbereidingstaak ----> Waterspider
   |
   +---- omsteltaak -----------> Operator
   |
   +---- QC-aanvraag ----------> Camera / QC
                                   |
                                   | OK / NOK-resultaat
                                   v
                          Digital Workstation
```

### Lokale prototypegegevens

> **Belangrijk:** Sommige prototypegegevens worden lokaal in de browser opgeslagen. Het wissen van sitegegevens, het gebruiken van een andere browser of het wisselen van toestel kan lokale referenties of workflowstatus verwijderen.

---

## 9. Herstel en reset

Wanneer het prototype in een inconsistente toestand terechtkomt:

1. stop de huidige demonstratie of test;
2. herlaad de betrokken interface;
3. controleer het geselecteerde product;
4. controleer de huidige workflowstatus;
5. open indien nodig de Camera / QC-interface opnieuw;
6. herhaal de mislukte stap;
7. start de testreeks opnieuw wanneer de toestand niet betrouwbaar kan worden hersteld.

Wanneer browseropslag wordt gewist, kan het nodig zijn om productreferenties opnieuw in te stellen.

---

## 10. Probleemoplossing

| Probleem | Controle | Actie |
|---|---|---|
| Applicatie laadt niet | Netwerk / browser | Controleer de verbinding en herlaad de pagina. |
| Verkeerd product wordt weergegeven | Productselectie | Stop en controleer het geselecteerde product / de actieve omstelling. |
| Camera niet beschikbaar | Browsermachtigingen | Sta cameratoegang toe en herlaad de QC-interface. |
| Camerabeeld blijft zwart | Camera in gebruik / machtigingen | Sluit andere camera-apps en controleer de browsermachtigingen. |
| Malcontrole geeft NOK | Verkeerde mal of positie | Corrigeer de mal en voer de controle opnieuw uit. |
| Eindcontrole geeft NOK | Product wijkt af van de vereisten | Controleer het product, corrigeer de fout en controleer opnieuw. |
| QC-resultaat wordt niet teruggestuurd | Communicatieprobleem | Controleer netwerk, herlaad de QC-interface en herhaal de controle. |
| Verkeerde instructies worden getoond | Verkeerde workflow- of productstatus | Stop de montage en controleer het actieve product. |
| Materiaal ontbreekt | Voorbereiding onvolledig | Waterspider vult het ontbrekende materiaal aan. |
| Gereedschap ontbreekt | Voorbereiding onvolledig | Bereid het juiste gereedschap voor vóór de workflow verdergaat. |

---

## 11. Veiligheid en beperkingen

Het Digital Workstation is bedoeld als **productieondersteunend systeem**.

Het mag niet worden gebruikt als enige veiligheidsvoorziening voor machines of assemblageapparatuur.

Het systeem vervangt geen:

- noodstopsystemen;
- machineafscherming;
- mechanische vergrendelingen;
- koppelgestuurd gereedschap waar vereist;
- goedgekeurde technische specificaties;
- wettelijk vereiste machineveiligheidsfuncties.

Wanneer een digitale instructie strijdig is met een goedgekeurde technische tekening of gecontroleerde productiespecificatie, moet de productie worden gestopt en moet de afwijking worden onderzocht.

### Beperkingen van vision

De prestaties van de cameracontrole kunnen worden beïnvloed door:

- verlichting;
- reflecties op aluminium;
- camerahoek;
- camera-afstand;
- oriëntatie van componenten;
- afdekking van referentiemarkers.

Voor betrouwbaar gebruik worden een vaste camerapositie en stabiele verlichting aanbevolen.

---

## 12. Onderhoud

Controleer regelmatig of:

- digitale werkinstructies actueel zijn;
- technische tekeningen de laatste revisie bevatten;
- referenties van de mallen correct zijn;
- cameramarkers schoon en onbeschadigd zijn;
- de cameralens schoon is;
- de camerabevestiging niet is verschoven;
- componentdefinities overeenkomen met de fysieke werkpost;
- labels en opslaglocaties overeenkomen met de digitale workflow;
- verouderde productinformatie verwijderd is.

Na belangrijke wijzigingen aan een product of mal moeten ook de digitale referentiegegevens opnieuw worden gecontroleerd.

---

## 13. Inbedrijfstelling / acceptatiechecklist

Controleer vóór een demonstratie of productievalidatie:

- [ ] Manager kan een productwissel starten.
- [ ] Waterspider ontvangt de juiste voorbereidingstaak.
- [ ] Operator ontvangt de juiste omstelworkflow.
- [ ] Correcte mal geeft een `OK`-resultaat.
- [ ] Verkeerde mal geeft een `NOK`-resultaat.
- [ ] Een `NOK`-resultaat blokkeert normale voortgang.
- [ ] Product 1-instructies komen overeen met Product 1.
- [ ] Product 2-instructies komen overeen met Product 2.
- [ ] Eindcontrole kan een `OK`-resultaat teruggeven.
- [ ] Eindcontrole kan een `NOK`-resultaat teruggeven.
- [ ] QC-resultaat wordt teruggestuurd naar de Operator-interface.
- [ ] Vereiste productdocumentatie is beschikbaar.
- [ ] Alle toestellen hebben een stabiele netwerkverbinding.

---

## 14. Aanbevolen uitbreidingen voor productiegebruik

Voor verdere ontwikkeling na de prototypefase worden de volgende uitbreidingen aanbevolen.

### Gebruikers- en toegangsbeheer

- geauthenticeerde gebruikers;
- rolgebaseerde rechten;
- administratoraccounts.

### Centrale gegevensopslag

- productiedatabase;
- centrale productreferenties;
- productiehistoriek;
- opslag van QC-resultaten.

### Traceerbaarheid

Mogelijke gegevens om op te slaan:

- productvariant;
- operator-ID;
- start- en eindtijd van de omstelling;
- resultaat malcontrole;
- resultaat eindcontrole;
- reden van NOK;
- herwerking;
- tijdstempels.

### Revisiebeheer

Zorg ervoor dat enkel de meest recente goedgekeurde versie van de volgende documenten gebruikt kan worden:

- werkinstructie;
- technische tekening;
- onderdelenlijst;
- QC-referentie.

### Industriële integratie

Mogelijke toekomstige integraties:

- MES;
- ERP;
- barcode- / QR-scanning;
- RFID;
- gereedschapsverificatie;
- automatische KPI-registratie;
- gevalideerde industriële vision.

---

## 15. Beoogde voordelen

Het Digital Workstation wil bijdragen aan:

- kortere interne omsteltijd;
- minder zoeken;
- minder wachten;
- minder montagefouten;
- gestandaardiseerd werk;
- duidelijkere rolverdeling;
- externe voorbereiding van omstelactiviteiten;
- betere productkwaliteit;
- eenvoudiger opleiden van operatoren;
- betere traceerbaarheid;
- gestructureerde continue verbetering.

Het Digital Workstation moet daarom samen met de **fysieke verbeteringen aan de werkpost** worden beschouwd en niet als een losstaande oplossing.

---

## 16. Projectstatus

**Huidige maturiteit:** Functioneel prototype / demonstrator.

Het prototype demonstreert de integratie van:

> **SMED-methodologie + gestandaardiseerde werkpost + digitale instructies + rolgebaseerde workflows + geautomatiseerde kwaliteitscontrole**

Voor commerciële inzet zijn bijkomende validaties nodig op het vlak van:

- betrouwbaarheid;
- cybersecurity;
- authenticatie;
- gegevensopslag;
- industriële veiligheid;
- traceerbaarheid;
- productie-integratie;
- robuustheid van kwaliteitscontrole.

---

## 17. Repositorystructuur

Een aanbevolen repositorystructuur is:

```text
DigitalWorkstation/
|
|-- README.md
|-- src/
|-- public/
|-- package.json
|-- ...
|
`-- docs/
    |-- SYSTEM_ARCHITECTURE.md
    |-- QUALITY_CONTROL.md
    |-- TROUBLESHOOTING.md
    `-- images/
```

Voor het huidige prototype bevat deze `README.md` het belangrijkste technische en productoverzicht.

Meer gedetailleerde documentatie kan later worden toegevoegd in de map `/docs`.

---

## 18. Documentinformatie

| Veld | Waarde |
|---|---|
| Product | Digital Workstation |
| Document | Repository README / Technisch productoverzicht |
| Versie | 1.0 |
| Status | Prototypedocumentatie |
| Auteur | Florine De Spiegeleer |
| Projectcontext | Sirris / UGent |
| Datum | September 2026 |

---

## Live prototype

**Digital Workstation:**  
https://florinedespiegeleer.github.io/DigitalWorkstation/

---

## Gebruik

Deze repository bevat een prototype dat werd ontwikkeld binnen een industrieel engineering- en werkpostverbeteringsproject.

Vóór hergebruik in een productieomgeving moet het systeem worden gevalideerd voor het specifieke proces, product, de gebruikte hardware en de geldende veiligheidsvereisten.
