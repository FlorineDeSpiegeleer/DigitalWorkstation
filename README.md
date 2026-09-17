# Digital Workstation

Browser-based production support system for product changeovers, assembly guidance and quality control.

**Project status:** Functional prototype / demonstrator  
**Application:** Digital support for SMED-based changeover and assembly  
**Live prototype:** https://florinedespiegeleer.github.io/DigitalWorkstation/

---

## 1. Overview

The **Digital Workstation** supports operators and supporting production roles during product changeovers and assembly operations.

The system was developed to reduce searching, waiting, setup variation and assembly errors by combining:

- role-based digital workflows;
- external preparation by a Waterspider;
- guided changeover instructions;
- product-specific assembly instructions;
- fixture verification;
- final product quality control;
- communication between multiple devices;
- standardized work and SMED principles.

The current prototype supports **Product 1** and **Product 2**.

> **Important:** The Digital Workstation is a production-support prototype. It does not replace mechanical safety systems, torque verification or qualified inspection of safety-critical assemblies.

---

## 2. System at a glance

The system consists of four main interfaces.

| Interface | Purpose |
|---|---|
| **Manager** | Starts a product changeover and follows its progress. |
| **Waterspider** | Prepares materials, tools, documentation and the correct fixture before the internal changeover starts. |
| **Operator** | Executes the changeover and assembly using guided digital instructions. |
| **Camera / Quality Control** | Performs fixture verification and final product inspection. |

### Typical workflow

```text
Manager
  |
  v
Start product changeover
  |
  v
Waterspider
Prepare materials, tools, fixture and documentation
  |
  v
Operator
Start internal changeover
  |
  v
Camera / QC
Fixture verification
  |
  +---- NOK --> Correct setup --> Re-check
  |
  v
Operator
Start production and follow assembly instructions
  |
  v
Camera / QC
Final product inspection
  |
  +---- NOK --> Correct product --> Re-check
  |
  v
Product released
```

---

## 3. Getting started

### Prototype requirements

Recommended hardware:

- PC or tablet for the Manager;
- tablet or mobile device for the Waterspider;
- tablet in landscape orientation for the Operator;
- smartphone or camera-enabled device for Quality Control;
- network / internet connection;
- modern browser with JavaScript enabled.

### Initial setup

1. Open the Digital Workstation on the required devices.
2. Assign the correct interface to each role.
3. Open the Camera / QC interface on the camera device.
4. Allow camera access when requested by the browser.
5. Verify that all devices have network access.
6. Verify the active product configuration.
7. Confirm that the correct product reference data are available.
8. Perform one communication test between the interfaces.
9. Perform one fixture QC test.
10. Perform one final QC test before using the system in a demonstration or validation run.

---

## 4. Roles and responsibilities

### Manager

The Manager initiates a change from the current product to the required next product.

Main functions:

- select the next product;
- start the changeover;
- follow preparation and changeover status;
- monitor workflow progress.

### Waterspider

The Waterspider performs **external setup activities** before the Operator starts the internal changeover.

Typical tasks:

- prepare required components;
- replenish component bins;
- prepare aluminium profiles;
- prepare the correct tools;
- prepare the correct fixture;
- prepare product documentation;
- confirm that the workstation is ready.

The objective is to ensure that the Operator does not need to search for materials or tools during the internal changeover.

### Operator

The Operator interface guides the production employee through:

1. completion of the current production;
2. changeover start;
3. removal of the previous setup;
4. installation of the new fixture;
5. fixture quality control;
6. component and tool verification;
7. production start;
8. step-by-step assembly;
9. final product quality control;
10. product completion.

### Administrator

Administrative functions are intended for system setup and maintenance.

Typical administrative functions include:

- product-specific reference configuration;
- quality-control configuration;
- replacing reference images;
- maintaining product-specific data;
- managing prototype settings.

---

## 5. Product configuration

The current prototype supports two product variants.

| Configuration item | Product 1 | Product 2 |
|---|---|---|
| Product-specific fixture | Fixture P1 | Fixture P2 |
| Work instructions | P1 instructions | P2 instructions |
| Technical documentation | P1 documentation | P2 documentation |
| Final QC reference | P1 reference | P2 reference |
| Component checklist | Product-specific | Product-specific |

Each product must therefore have the correct fixture, instructions, technical drawing, component list and QC reference.

---

## 6. Production workflow

### Phase 1 — Product change requested

The Manager selects the required next product.

Example:

```text
Product 1 -> Product 2
```

The required preparation activities are then initiated.

### Phase 2 — External preparation

The Waterspider prepares the workstation while the previous product may still be in production.

This includes, where applicable:

- component kits;
- aluminium profiles;
- fasteners;
- tools;
- fixture;
- work instructions;
- technical drawings;
- labels.

Once preparation is complete, the workstation is marked as ready.

### Phase 3 — Internal changeover

After the final product of the current series is completed, the Operator starts the internal changeover.

Typical actions:

- remove the previous setup;
- install the new fixture;
- verify the fixture;
- confirm prepared components;
- confirm prepared tools.

### Phase 4 — Production

After successful fixture verification, the Operator can start production.

The Operator then follows the product-specific digital assembly instructions.

### Phase 5 — Final quality control

After assembly, the product is checked before release.

A mandatory **NOK** result must be corrected before the workflow continues.

---

## 7. Quality control

The system uses two distinct quality-control moments.

### 7.1 Fixture QC

**Purpose:** Verify that the correct fixture/setup is installed before production starts.

**Input:** Camera image of the workstation fixture.

**Output:**

- `OK` — workflow may continue;
- `NOK` — setup must be corrected and checked again.

### 7.2 Final Product QC

**Purpose:** Support verification of the finished product after assembly.

Depending on the active prototype configuration, the system can evaluate visible product characteristics such as:

- expected product geometry;
- component presence;
- wheel positions;
- product-specific visual reference;
- general assembly configuration.

**Output:**

- `OK` — product may proceed to release;
- `NOK` — product must be corrected and checked again.

### QC limitations

The camera does **not** verify:

- tightening torque;
- hidden fastener engagement;
- internal material defects;
- structural strength;
- hidden damage;
- mechanical safety compliance.

These items require separate controls where relevant.

---

## 8. System architecture

The prototype uses a lightweight browser-based architecture.

Main mechanisms include:

- **GitHub Pages** for prototype hosting;
- **browser localStorage** for selected local state and stored reference data;
- **ntfy** for event/status communication between interfaces;
- an **embedded QC interface** for final inspection;
- browser **postMessage** communication for QC result transfer.

Conceptually:

```text
Manager
   |
   | product change request
   v
Digital Workstation
   |
   +---- preparation task ----> Waterspider
   |
   +---- changeover task -----> Operator
   |
   +---- QC request ----------> Camera / QC
                                  |
                                  | OK / NOK result
                                  v
                         Digital Workstation
```

### Local prototype data

> **Important:** Some prototype data are stored locally in the browser. Clearing site data, changing browser or changing device may remove local references or workflow state.

---

## 9. Recovery and reset

If the prototype enters an inconsistent state:

1. stop the current demonstration or test;
2. reload the affected interface;
3. verify the selected product;
4. verify the current workflow state;
5. reopen the Camera / QC interface if required;
6. repeat the failed step;
7. restart the test sequence if the state cannot be recovered reliably.

If browser storage is cleared, product reference data may need to be configured again.

---

## 10. Troubleshooting

| Issue | Check | Action |
|---|---|---|
| Application does not load | Network / browser | Verify connection and reload the page. |
| Wrong product displayed | Product selection | Stop and verify the selected product/changeover. |
| Camera unavailable | Browser permissions | Enable camera access and reload the QC interface. |
| Camera image is black | Camera in use / permission issue | Close other camera apps and verify permissions. |
| Fixture QC returns NOK | Fixture or position incorrect | Reposition the fixture and repeat inspection. |
| Final QC returns NOK | Product differs from requirements | Inspect the product, correct the issue and re-check. |
| QC result is not returned | Communication interruption | Verify network, reload QC interface and repeat inspection. |
| Wrong instructions are shown | Incorrect workflow/product state | Stop assembly and verify the active product. |
| Material is missing | Preparation incomplete | Waterspider replenishes the required material. |
| Tool is missing | Preparation incomplete | Prepare the correct tool before continuing. |

---

## 11. Safety and limitations

The Digital Workstation is intended as a **production-support system**.

It must not be used as the sole safety mechanism for machinery or assembly equipment.

The system does not replace:

- emergency-stop systems;
- machine guarding;
- mechanical interlocks;
- torque-controlled tooling where required;
- approved technical specifications;
- legally required machine-safety functions.

If a digital instruction conflicts with an approved technical drawing or controlled manufacturing specification, production should be stopped and the discrepancy investigated.

### Vision-related limitations

Camera performance can be influenced by:

- lighting;
- reflections from aluminium;
- camera angle;
- camera distance;
- component orientation;
- obstruction of reference markers.

A controlled camera position and stable lighting are recommended for reliable use.

---

## 12. Maintenance

Regularly verify that:

- digital work instructions are current;
- technical drawings use the latest revision;
- fixture references are correct;
- camera markers are clean and undamaged;
- the camera lens is clean;
- camera mounting has not moved;
- component definitions match the physical workstation;
- labels and storage locations correspond with the digital workflow;
- obsolete product information has been removed.

After significant modifications to a product or fixture, the digital reference data should also be reviewed.

---

## 13. Commissioning / acceptance checklist

Before a demonstration or production validation, verify:

- [ ] Manager can initiate a product changeover.
- [ ] Waterspider receives the correct preparation task.
- [ ] Operator receives the correct changeover workflow.
- [ ] Correct fixture produces an `OK` result.
- [ ] Incorrect fixture produces a `NOK` result.
- [ ] A `NOK` result blocks normal progression.
- [ ] Product 1 instructions correspond with Product 1.
- [ ] Product 2 instructions correspond with Product 2.
- [ ] Final QC can return an `OK` result.
- [ ] Final QC can return a `NOK` result.
- [ ] QC result is returned to the Operator interface.
- [ ] Required product documentation is available.
- [ ] All devices have stable network access.

---

## 14. Recommended production-grade extensions

For development beyond the prototype stage, the following extensions are recommended:

### User and access management

- authenticated users;
- role-based permissions;
- administrator accounts.

### Centralized data

- production database;
- centralized product references;
- production history;
- QC result storage.

### Traceability

Store:

- product variant;
- operator ID;
- changeover start/end;
- fixture QC result;
- final QC result;
- NOK reason;
- rework;
- timestamps.

### Revision control

Ensure that only the latest approved work instruction, technical drawing, component list and QC reference can be used.

### Industrial integration

Future integrations could include:

- MES;
- ERP;
- barcode / QR scanning;
- RFID;
- tool verification;
- automatic KPI logging;
- validated industrial vision.

---

## 15. Intended benefits

The Digital Workstation aims to contribute to:

- shorter internal changeover time;
- reduced searching;
- reduced waiting;
- fewer assembly mistakes;
- standardized work;
- clearer division of responsibilities;
- external preparation of setup activities;
- improved product quality;
- easier operator training;
- better process traceability;
- structured continuous improvement.

The Digital Workstation should therefore be considered together with the **physical workstation improvements** rather than as a standalone intervention.

---

## 16. Project status

**Current maturity:** Functional prototype / demonstrator.

The prototype demonstrates the integration of:

> **SMED methodology + standardized workstation + digital instructions + role-based workflows + automated quality control**

Before commercial deployment, additional validation would be required for:

- reliability;
- cybersecurity;
- authentication;
- data storage;
- industrial safety;
- traceability;
- production integration;
- quality-control robustness.

---

## 17. Repository structure

A recommended repository structure is:

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

For the current prototype, this `README.md` provides the main technical and product overview.

Additional detailed documentation can be added to the `/docs` folder as the system develops.

---

## 18. Document information

| Field | Value |
|---|---|
| Product | Digital Workstation |
| Document | Repository README / Technical Product Overview |
| Version | 1.0 |
| Status | Prototype documentation |
| Author | Florine De Spiegeleer |
| Project context | Sirris / UGent |
| Date | September 2026 |

---

## Live prototype

**Digital Workstation:**  
https://florinedespiegeleer.github.io/DigitalWorkstation/

---

## License / usage

This repository contains a prototype developed for an industrial engineering / workstation-improvement project.

Before reuse in a production environment, the system should be validated for the specific process, product, hardware and safety requirements.
