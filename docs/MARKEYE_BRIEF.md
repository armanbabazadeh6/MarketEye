# Project: MarketEye

Build **MarketEye**, an agentic geospatial market-intelligence platform on top of the open-source `bilawalsidhu/gods-eye-view` repository.

MarketEye should feel like **Bloomberg + Palantir + Google Earth**.

The core idea:

> Search a public company and immediately understand where that company depends on the physical world, what global events are happening around those dependencies, and why those events could matter financially.

The existing God's Eye View project should be treated as infrastructure, not as the finished product. Reuse its Cesium globe, live spatial-data layers, camera controls, tracking systems, visualization infrastructure, annotations, AI tool-calling architecture, and useful backend integrations.

Transform the application into a distinct product.

Do not merely reskin God's Eye View.

---

# Product Vision

A user should be able to search:

`NVDA`

and watch the globe automatically transition into an NVIDIA intelligence view.

Relevant NVIDIA geographic exposure appears on Earth:

* headquarters
* major offices
* semiconductor manufacturing dependencies
* TSMC facilities
* suppliers
* ports
* airports
* datacenters
* logistics hubs
* relevant infrastructure
* important geographic regions

MarketEye then correlates those company dependencies with live or recent world signals such as:

* earthquakes
* severe weather
* shipping activity
* port activity
* aircraft activity
* infrastructure
* supply-chain chokepoints
* natural disasters
* fires where available
* regional news
* geopolitical events where reliable data can be sourced
* satellite or other existing GEV data where relevant

The user should be able to understand:

> What in the world could affect this company right now?

---

# Core Product Principle

MarketEye is not a stock-price dashboard.

It is a **physical-world exposure intelligence system**.

The value comes from connecting:

`WORLD EVENT -> ASSET / SUPPLIER / INFRASTRUCTURE -> COMPANY -> MARKET IMPACT`

Example:

`Taiwan earthquake`

↓

`TSMC advanced semiconductor manufacturing`

↓

`NVIDIA GPU supply`

↓

`Potential production disruption`

↓

`NVDA exposure`

Another example:

`Red Sea shipping disruption`

↓

`Suez route avoidance`

↓

`Longer Asia-Europe shipping routes`

↓

`Higher fuel + freight costs`

↓

`Retail / automotive / industrial exposure`

MarketEye should visually represent these causal chains.

---

# Initial Scope

Do not try to support every public company immediately.

Build an exceptional initial experience around:

1. NVIDIA
2. Apple
3. Tesla

Architect the system so additional companies can be added easily through structured datasets.

NVIDIA should receive the most polish and should serve as the flagship demo.

---

# Flagship NVIDIA Experience

When a user searches for NVIDIA or `NVDA`:

1. Transition the globe toward Asia / Taiwan.
2. Load NVIDIA-related geographic dependencies.
3. Highlight Taiwan as a key supply-chain region.
4. Show important semiconductor manufacturing locations.
5. Show relevant TSMC facilities where reliable public information allows.
6. Show nearby ports and airports.
7. Correlate active earthquakes, weather, shipping, and relevant world signals.
8. Calculate geographic exposure.
9. Populate a market intelligence panel.
10. Allow the user to trigger an automated investigation.

The user should immediately understand why Taiwan matters to NVIDIA.

---

# Main UI

Replace the current military/intelligence-simulator feel with a financial intelligence terminal.

Visual direction:

* dark
* sophisticated
* premium
* dense but readable
* institutional finance
* modern trading terminal
* geospatial intelligence
* minimal unnecessary decoration
* no cheesy cyberpunk UI
* no generic AI-dashboard appearance

Think:

* Bloomberg Terminal
* Palantir operational software
* Linear-level polish
* Google Earth
* institutional research terminal

Avoid copying any company's proprietary interface directly.

---

# Application Layout

Primary layout should roughly contain:

## Left Panel

### Watchlist

Example:

NVDA
AAPL
TSLA

Eventually support more companies.

### Live Signals

Examples:

* earthquake
* severe weather
* shipping disruption
* major regional event
* infrastructure warning

Selecting a signal should focus the globe on it.

---

## Center

Large Cesium 3D Earth.

This remains the visual centerpiece.

The globe should support:

* company assets
* suppliers
* ports
* airports
* infrastructure
* live world layers
* event markers
* animated paths
* geographic risk regions
* company dependency lines
* camera fly-to
* automatic investigation tours

Do not clutter the globe unnecessarily.

Information should appear progressively depending on context and zoom level.

---

## Right Panel

Company intelligence panel.

Example:

NVIDIA
NASDAQ: NVDA

GEOGRAPHIC EXPOSURE
67 / 100
HIGH

KEY DEPENDENCIES

Taiwan
Advanced semiconductor manufacturing
HIGH

United States
R&D / AI infrastructure
MEDIUM

Southeast Asia
Electronics supply chain
MEDIUM

CURRENT SIGNALS

1. Severe weather near Taiwan
2. Earthquake within X km of semiconductor infrastructure
3. Elevated shipping activity near major port
4. No confirmed facility interruption

Then:

`INVESTIGATE`

---

# Company Data Model

Build a clean reusable company schema.

Suggested structure:

```ts
interface Company {
  ticker: string;
  name: string;
  exchange?: string;
  sector: string;
  industry?: string;

  description?: string;

  locations: CompanyLocation[];
  suppliers: SupplierRelationship[];
  dependencies: CompanyDependency[];
  regions: GeographicExposure[];
}
```

Example location:

```ts
interface CompanyLocation {
  id: string;
  name: string;

  type:
    | "headquarters"
    | "office"
    | "factory"
    | "supplier"
    | "datacenter"
    | "port"
    | "airport"
    | "mine"
    | "logistics"
    | "infrastructure";

  latitude: number;
  longitude: number;

  importance: number;

  description?: string;
  source?: string;
  confidence?: number;
}
```

Supplier relationship:

```ts
interface SupplierRelationship {
  company: string;
  supplier: string;

  category:
    | "semiconductor"
    | "manufacturing"
    | "battery"
    | "raw_material"
    | "logistics"
    | "cloud"
    | "energy"
    | "other";

  criticality: number;

  locations?: string[];

  confidence?: number;
  source?: string;
}
```

Do not fabricate precise supply-chain facts.

Any manually curated data should have provenance fields.

---

# Event Model

Normalize external world events into a shared structure.

```ts
interface MarketEvent {
  id: string;

  type:
    | "earthquake"
    | "weather"
    | "shipping"
    | "fire"
    | "airport"
    | "infrastructure"
    | "geopolitical"
    | "news"
    | "other";

  title: string;
  description?: string;

  latitude: number;
  longitude: number;

  severity: number;
  confidence: number;

  timestamp: string;

  source: string;
  sourceUrl?: string;

  metadata?: Record<string, unknown>;
}
```

Existing God's Eye View data sources should be adapted into this normalized event model where appropriate.

---

# Exposure Engine

Create an exposure engine that correlates world events with company dependencies.

Output something similar to:

```ts
interface CompanyExposure {
  companyTicker: string;
  eventId: string;

  score: number;

  severity: "low" | "medium" | "high" | "critical";

  distanceKm?: number;

  affectedLocations: string[];
  affectedDependencies: string[];

  positiveFactors: ExposureFactor[];
  mitigatingFactors: ExposureFactor[];

  confidence: number;

  explanation: string;
}
```

Exposure scoring should be deterministic before AI explanation.

Do not let an LLM simply invent a risk number.

A reasonable initial formula could consider:

* event severity
* geographic proximity
* asset importance
* supplier criticality
* dependency importance
* event confidence
* data freshness

Exact weights can evolve.

Keep scoring explainable.

The UI should be able to show why a company received a score.

Example:

`82 HIGH`

Reasons:

* Critical semiconductor supplier
* 34 km from affected facility
* High geographic concentration
* Magnitude 6.7 earthquake

Mitigating factors:

* No confirmed facility closure
* No port shutdown detected
* No major airport disruption detected

---

# Impact Graph

Build an explicit causal graph system.

Example nodes:

* Event
* Region
* Facility
* Supplier
* Infrastructure
* Commodity
* Logistics route
* Company
* Industry
* Sector

Example edges:

* affects
* supplies
* manufactures
* transports
* depends_on
* located_in
* routes_through
* exposed_to

Example:

Red Sea disruption
-> affects
Suez shipping

Suez shipping
-> affects
Asia-Europe transit

Asia-Europe transit
-> affects
Nike

The system should render these relationships both:

1. as UI graph / reasoning chain
2. geographically on the globe where meaningful

---

# Impact Paths

This should become one of MarketEye's signature features.

Example:

RED SEA DISRUPTION

↓

SUEZ TRAFFIC REDUCED

↓

VESSELS REROUTE AROUND CAPE OF GOOD HOPE

↓

TRANSIT TIME INCREASES

↓

FUEL COSTS INCREASE

↓

FREIGHT RATES INCREASE

↓

EXPOSED COMPANIES

* Apple
* Nike
* BMW
* industrial manufacturers
* European retailers

When possible, animate relevant geographic routes directly on Earth.

---

# AI Analyst

Build an AI analyst layer that reasons over structured MarketEye state.

The AI must not operate as a generic chatbot.

It should have access to tools.

Potential tools:

```ts
searchCompany()
getCompanyExposure()
getCompanyLocations()
getSuppliers()
getNearbyEvents()
getNearbyInfrastructure()
showCompanyAssets()
highlightLocation()
flyToLocation()
showEarthquakes()
showShips()
showFlights()
showPorts()
drawRoute()
drawRadius()
drawImpactPath()
compareCompanies()
investigateEvent()
generateCompanyBrief()
```

Reuse useful patterns from the existing God's Eye View voice/tool architecture.

Text interaction should work first.

Voice can remain optional.

---

# AI Behavior

The AI should understand:

* selected company
* selected event
* visible globe region
* active layers
* company dependency graph
* recent world events
* calculated exposure scores
* data provenance
* confidence levels

Questions should include:

"What is NVIDIA's biggest geographic risk?"

"Why is NVIDIA exposed to Taiwan?"

"Show Apple's manufacturing exposure."

"What companies could this earthquake affect?"

"Why could oil prices move because of this?"

"Show semiconductor supply-chain risks."

"Compare Apple and NVIDIA's Taiwan exposure."

"Show me."

The phrase:

`Show me`

should trigger globe actions, not another long text response.

---

# Investigation Mode

Create an `INVESTIGATE` workflow.

This should be visually impressive.

When triggered:

1. Identify the highest-value evidence.
2. Create an investigation plan.
3. Fly the globe to the first location.
4. Highlight the relevant asset.
5. Display the supporting event.
6. Move through additional evidence.
7. Draw geographic relationships.
8. Update the reasoning panel live.
9. Produce a final intelligence brief.

Example activity timeline:

01 Detected magnitude 6.8 earthquake
02 Located semiconductor facilities within 200 km
03 Identified NVIDIA supplier exposure
04 Checked nearby ports
05 Checked airport activity
06 Checked weather conditions
07 Reviewed regional signals
08 Calculated geographic exposure
09 Generated assessment

The agent should not pretend an action succeeded if the underlying tool failed.

---

# Market Brief

Allow MarketEye to produce a structured brief.

Example:

## NVIDIA Geographic Risk Brief

### Current Exposure

HIGH

### Primary Risk

Taiwan semiconductor concentration

### Active Signals

* magnitude X earthquake
* severe weather
* shipping conditions
* regional logistics signals

### Potential Impact Chain

Event
-> supplier
-> manufacturing dependency
-> NVIDIA

### Evidence

Show sources.

### Confidence

Moderate / High

### Unknowns

Explicitly identify missing or unconfirmed information.

The product must distinguish:

* confirmed fact
* inference
* unknown
* stale data

---

# Globe Layers

Preserve relevant existing layers.

Likely useful:

* flights
* ships
* earthquakes
* weather
* traffic
* satellites
* datacenters
* submarine cables
* ports where added
* infrastructure
* public cameras where contextually useful

Remove or de-emphasize features that are primarily military-themed unless they directly support MarketEye.

Do not delete useful underlying infrastructure prematurely.

---

# Financial Data

Design an abstraction for market data, but do not let stock pricing become the main engineering bottleneck.

Initial build can work without real-time exchange-grade financial feeds.

Support a clean provider abstraction like:

```ts
interface MarketDataProvider {
  getQuote(ticker: string): Promise<Quote>;
  getCompanyProfile(ticker: string): Promise<CompanyProfile>;
}
```

Use public/free APIs if appropriate.

Fail gracefully when live market pricing is unavailable.

MarketEye's primary differentiator is geospatial exposure, not quote delivery.

---

# Provenance

Every important external fact should preserve source metadata where possible.

Examples:

* supplier relationship
* factory location
* event
* article
* infrastructure record
* risk signal

The AI should be able to say:

"According to X..."

or display a source in the interface.

Do not allow unsourced LLM-generated company infrastructure to silently enter the system as fact.

---

# Reliability

External APIs fail.

Design accordingly.

Use:

* caching
* stale-while-revalidate where sensible
* graceful empty states
* retry policies
* source status
* timestamps
* degraded mode

Never make the entire globe unusable because one provider is unavailable.

---

# Project Structure

Refactor toward modular MarketEye domains.

A possible target:

```text
src/
  globe/
  companies/
  markets/
  exposure/
  events/
  impact/
  analyst/
  providers/
  ui/
  utils/
```

Company datasets:

```text
data/
  companies/
    nvda.json
    aapl.json
    tsla.json
```

Do not perform a giant unnecessary rewrite solely to satisfy this exact directory structure.

Use judgment.

---

# Development Strategy

Work autonomously.

Inspect the existing God's Eye View implementation thoroughly before changing architecture.

Reuse proven functionality.

Do not rebuild Cesium functionality that already works.

Make incremental commits or logically separated implementation stages.

Keep the application runnable throughout development.

Use existing testing infrastructure.

Add tests for new non-visual logic.

Especially test:

* distance calculations
* exposure scoring
* event correlation
* impact graph generation
* company dataset validation
* provider normalization

---

# Phase 1

Deliver a working MarketEye shell.

Requirements:

* complete product rename
* new branding
* new terminal-style UI
* watchlist
* company search
* right-side company intelligence panel
* preserve functioning Cesium globe
* NVIDIA selectable
* Apple selectable
* Tesla selectable
* globe flies to company-related regions
* company locations render as a new layer

---

# Phase 2

Implement NVIDIA geographic intelligence.

Requirements:

* curated NVIDIA dataset
* curated critical supplier relationships
* Taiwan exposure
* TSMC-related geographic dependencies where publicly supportable
* relevant ports
* airports
* infrastructure
* company location markers
* dependency visualization
* geographic exposure panel

This should already feel useful before AI.

---

# Phase 3

Build the exposure engine.

Requirements:

* normalized market events
* integrate existing earthquake data
* integrate weather signals
* correlate events with company assets
* deterministic exposure scoring
* confidence
* reasoning factors
* exposure badges
* affected-assets UI

---

# Phase 4

Build Impact Paths.

Requirements:

* causal graph representation
* event -> infrastructure -> supplier -> company
* readable visual chain
* corresponding globe visualization where geographic
* reusable graph model

---

# Phase 5

Build AI Analyst.

Requirements:

* analyst chat
* context-aware company analysis
* MarketEye tools
* globe control
* structured evidence
* tool execution
* source awareness
* confidence awareness

Do not make this a plain LLM response window.

---

# Phase 6

Build INVESTIGATE mode.

Requirements:

* agent-created investigation sequence
* automated camera movement
* visual evidence highlighting
* activity timeline
* final brief
* graceful handling of missing evidence

---

# Phase 7

Polish flagship demo.

Optimize specifically for this flow:

1. Open MarketEye.
2. Search `NVDA`.
3. Globe flies toward Taiwan.
4. NVIDIA dependencies appear.
5. Relevant world events load.
6. Risk panel updates.
7. User asks:
   `Why is NVIDIA exposed to Taiwan?`
8. AI explains.
9. User presses:
   `INVESTIGATE`
10. MarketEye automatically tours the evidence.
11. Impact path appears.
12. Final intelligence brief is generated.

This workflow must look excellent in a screen recording.

---

# Branding

Use:

# MarketEye

Tagline:

**See what moves markets.**

Supporting copy:

> An agentic geospatial intelligence platform connecting global events, infrastructure, supply chains, and public-market exposure on a live 3D Earth.

Optional short line:

> Search a company. See where it depends on the world.

Avoid retaining "God's Eye View" branding throughout the visible product except where attribution/license requirements make acknowledgement appropriate.

Preserve all required open-source and third-party attribution.

---

# README

Rewrite the README around MarketEye.

Include:

* product overview
* hero image / GIF placeholder
* architecture overview
* flagship NVDA use case
* screenshots
* major features
* data sources
* AI analyst
* exposure scoring
* impact paths
* setup
* environment variables
* attribution
* limitations
* license considerations
* clear statement that MarketEye provides informational analysis and not investment advice

Make the repository look portfolio-quality.

---

# Quality Bar

Do not ship:

* placeholder UI everywhere
* obvious AI-generated visual clutter
* massive unstructured components
* fake data presented as live
* fake risk scores
* fabricated supplier relationships
* broken layers
* duplicated implementations
* unnecessary rewrites
* endless TODOs
* console errors
* secrets committed into source control
* brittle hard-coded demo logic when a reusable abstraction is reasonable

It is acceptable to hard-code a small number of carefully sourced company datasets for the MVP.

The distinction is:

curated structured data = acceptable

fabricated data = unacceptable

---

# Engineering Autonomy

You have latitude to improve the architecture when warranted.

Do not stop repeatedly for minor decisions.

Inspect the repo, make reasonable choices, implement, test, and continue.

When something is unclear:

1. inspect existing code
2. preserve existing behavior where useful
3. choose the simplest robust implementation
4. document important assumptions
5. continue

Optimize for a working polished product, not theoretical architecture.

---

# Definition of Done

The project is successful when someone who has never seen the code can open MarketEye, search `NVDA`, and within roughly 30 seconds understand:

* where NVIDIA depends on the physical world
* why Taiwan matters
* what relevant events are happening around those dependencies
* which assets or relationships may be exposed
* how MarketEye arrived at that conclusion
* where the supporting data came from

And then press `INVESTIGATE` and watch the application visually explain the answer on the globe.

The end result should feel like a new product built using God's Eye View as its geospatial foundation, not like a themed fork.
