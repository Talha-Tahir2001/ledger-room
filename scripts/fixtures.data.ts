/**
 * The fixture corpus. Ground truth is authored here, by hand, before the first
 * eval run and never edited to match model output (EVAL.md §1, rule 2).
 *
 * `acceptable` lists authored alternatives a correct answer may match. It is
 * the only concession to model freedom, and it is authored blind — it encodes
 * what the document genuinely permits, not what the model happened to emit.
 */

export interface FixtureLineItem {
  description: string
  quantity: number | null
  unitPrice: number | null
  amount: number | null
}

export interface FixtureTruth {
  vendor: string | null
  invoiceNo: string | null
  issueDate: string | null
  dueDate: string | null
  currency: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  category: string | null
  billable: boolean | null
  lineItems: FixtureLineItem[]
}

export interface Fixture {
  id: string
  name: string
  /** How the document reaches the extractor. */
  medium: "text-layer" | "image-only"
  /** Deliberate mess, recorded so EVAL.md can attribute failures to causes. */
  mess: string[]
  text: string
  truth: FixtureTruth
  acceptable?: Partial<Record<keyof FixtureTruth, (string | number | boolean)[]>>
  /** Ambiguous fixtures are scored leniently and reported separately. */
  ambiguous?: boolean
}

export const FIXTURES: Fixture[] = [
  {
    id: "01-saas-team-plan",
    name: "SaaS subscription, table layout, USD",
    medium: "text-layer",
    mess: [],
    text: `NORTHWIND ANALYTICS
Suite 400, 1200 Market Street
San Francisco, CA 94102

INVOICE
Invoice Number: NW-2026-0431
Issue Date: 2026-03-14
Due Date: 2026-04-13
Terms: Net 30

Bill To:
Sam Rivera
Rivera Design Studio

Description                          Qty     Unit Price        Amount
Analytics Pro - Team plan           12 mo        49.00          588.00
Additional seats                      3        19.00           57.00
Priority support                      1        75.00           75.00

Subtotal                                             720.00
Sales Tax (8.5%)                                       61.20
TOTAL DUE                                            781.20 USD

Payment is due within 30 days of the issue date.`,
    truth: {
      vendor: "NORTHWIND ANALYTICS",
      invoiceNo: "NW-2026-0431",
      issueDate: "2026-03-14",
      dueDate: "2026-04-13",
      currency: "USD",
      subtotal: 720,
      tax: 61.2,
      total: 781.2,
      category: "software",
      billable: null,
      lineItems: [
        { description: "Analytics Pro - Team plan", quantity: 12, unitPrice: 49, amount: 588 },
        { description: "Additional seats", quantity: 3, unitPrice: 19, amount: 57 },
        { description: "Priority support", quantity: 1, unitPrice: 75, amount: 75 },
      ],
    },
    acceptable: { category: ["software", "saas", "subscription"] },
  },

  {
    id: "02-restaurant-receipt",
    name: "Restaurant receipt, prose totals, no invoice number",
    medium: "text-layer",
    mess: ["no invoice number"],
    text: `THE GREEN KITCHEN
88 Rosemont Ave, Austin TX 78704

Table 12          Server: Dana        Check 4471

1x Espresso                          3.50
2x House sandwich                   11.00
1x Soup of the day                   7.25
3x Sparkling water                   9.00
1x Tiramisu                          8.50

Subtotal                            39.25
Tax                                  3.34
TOTAL                               42.59

03/22/2026   1:04 PM
Thank you for dining with us.`,
    truth: {
      vendor: "THE GREEN KITCHEN",
      invoiceNo: null,
      issueDate: "2026-03-22",
      dueDate: null,
      currency: "USD",
      subtotal: 39.25,
      tax: 3.34,
      total: 42.59,
      category: "meals",
      billable: false,
      lineItems: [
        { description: "Espresso", quantity: 1, unitPrice: null, amount: 3.5 },
        { description: "House sandwich", quantity: 2, unitPrice: null, amount: 11 },
        { description: "Soup of the day", quantity: 1, unitPrice: null, amount: 7.25 },
        { description: "Sparkling water", quantity: 3, unitPrice: null, amount: 9 },
        { description: "Tiramisu", quantity: 1, unitPrice: null, amount: 8.5 },
      ],
    },
    acceptable: {
      category: ["meals", "food", "restaurant", "dining"],
      issueDate: ["2026-03-22"],
    },
  },

  {
    id: "03-german-prose-total",
    name: "German invoice, decimal commas, EUR",
    medium: "text-layer",
    mess: ["decimal commas", "thousands separators", "prose totals"],
    text: `Rechnung

Dienstleister: Ludwig & Sohn GmbH
Rechnungsnummer: 2026-0455
Rechnungsdatum: 14.03.2026
Fällig am: 13.04.2026

Leistung                     Netto          MwSt          Brutto
Beratung Design          2.400,00 EUR    456,00 EUR   2.856,00 EUR

Rechnungsbetrag                                    2.856,00 EUR

Zahlbar innerhalb 30 Tagen ohne Abzug.`,
    truth: {
      vendor: "Ludwig & Sohn GmbH",
      invoiceNo: "2026-0455",
      issueDate: "2026-03-14",
      dueDate: "2026-04-13",
      currency: "EUR",
      subtotal: 2400,
      tax: 456,
      total: 2856,
      category: "consulting",
      billable: null,
      lineItems: [
        { description: "Beratung Design", quantity: null, unitPrice: null, amount: 2400 },
      ],
    },
    acceptable: { category: ["consulting", "professional services", "services", "design"] },
  },

  {
    id: "04-hardware-ocr-garbled",
    name: "Image-only hardware receipt with OCR garbling",
    medium: "image-only",
    mess: ["OCR noise", "spaced-out digits", "non-standard total label"],
    text: `~ S C A N   R E C E I P T ~
VENDOR:  Pixel Forge Hardware
DATE:    2 0 2 6 - 0 2 - 0 9
REF:     PF-99-2214

QTY  ITEM                  AMOUNT
  1  34" ultrawide m.on    549.00
  2  US B-C dock            89.95
  1  HDMI cab1e               12.50

             GRAND T0TAL     728.90

Currency: EUR`,
    truth: {
      vendor: "Pixel Forge Hardware",
      invoiceNo: "PF-99-2214",
      issueDate: "2026-02-09",
      dueDate: null,
      currency: "EUR",
      subtotal: 728.9,
      tax: null,
      total: 728.9,
      category: "hardware",
      billable: false,
      lineItems: [
        { description: '34" ultrawide monitor', quantity: 1, unitPrice: null, amount: 549 },
        { description: "USB-C dock", quantity: 2, unitPrice: null, amount: 89.95 },
        { description: "HDMI cable", quantity: 1, unitPrice: null, amount: 12.5 },
      ],
    },
    acceptable: { category: ["hardware", "equipment", "computer hardware"] },
  },

  {
    id: "05-utility-pkr",
    name: "Pakistani electricity bill, PKR, no tax line",
    medium: "text-layer",
    mess: ["no tax line", "Rs prefix instead of ISO code", "spaces in digits"],
    text: `K-ELECTRIC BILL
Consumer No: 4110229837
Billing Period: 01/01/2026 - 31/01/2026
Meter Reading Previous: 48210
Meter Reading Current: 49188

Units Consumed: 978
Tariff Category: Residential

Amount Payable: Rs 21,516
Due Date: 20/02/2026

This is a computer generated bill.`,
    truth: {
      vendor: "K-ELECTRIC",
      invoiceNo: "4110229837",
      issueDate: "2026-01-31",
      dueDate: "2026-02-20",
      currency: "PKR",
      subtotal: 21516,
      tax: null,
      total: 21516,
      category: "utilities",
      billable: false,
      lineItems: [],
    },
    acceptable: {
      category: ["utilities", "electricity", "energy", "utilities and energy"],
      invoiceNo: ["4110229837"],
      issueDate: ["2026-01-31", "2026-02-20"],
    },
  },

  {
    id: "06-coworking-gbp",
    name: "UK coworking membership, GBP, ambiguous date",
    medium: "text-layer",
    mess: ["ambiguous numeric date"],
    text: `THE WORKS LONDON
Unit 12, 4 Hackney Road, London E2 7NX

Membership Invoice
Ref: TWL-2026-0912
Date: 03/04/26
Payment due: 03/05/26

Description                       Amount
Hot desk - April                   320.00
Meeting room credits (10 hrs)     150.00
Locker rental                      25.00

Subtotal                          495.00
VAT 20%                            99.00
Total                            594.00 GBP`,
    truth: {
      vendor: "THE WORKS LONDON",
      invoiceNo: "TWL-2026-0912",
      issueDate: "2026-03-04",
      dueDate: "2026-05-03",
      currency: "GBP",
      subtotal: 495,
      tax: 99,
      total: 594,
      category: "coworking",
      billable: null,
      lineItems: [
        { description: "Hot desk - April", quantity: null, unitPrice: null, amount: 320 },
        { description: "Meeting room credits (10 hrs)", quantity: 10, unitPrice: 15, amount: 150 },
        { description: "Locker rental", quantity: null, unitPrice: null, amount: 25 },
      ],
    },
    acceptable: {
      category: ["coworking", "office", "workspace", "office rent"],
      issueDate: ["2026-03-04", "2026-04-03"],
      dueDate: ["2026-05-03", "2026-03-05"],
    },
    ambiguous: true,
  },

  {
    id: "07-client-invoice-billable",
    name: "Client invoice with explicit billable signal",
    medium: "text-layer",
    mess: [],
    text: `RIVERA DESIGN STUDIO
Invoice to: Halcyon Robotics Ltd
Attn: Finance Department

Invoice Number: RDS-2026-0118
Invoice Date: 2026-01-18
Due Date: 2026-02-17

Re: Product design retainer, January 2026
Billable to client per MSA section 4.

Line item                        Hours    Rate        Amount
UX audit and findings           12.0     145.00     1740.00
Design system updates           18.5     145.00     2682.50
Stakeholder workshop              4.0     145.00      580.00

Subtotal                                     5002.50
VAT 20%                                      500.25
TOTAL DUE                                   5502.75

Payment terms: Net 30`,
    truth: {
      vendor: "RIVERA DESIGN STUDIO",
      invoiceNo: "RDS-2026-0118",
      issueDate: "2026-01-18",
      dueDate: "2026-02-17",
      currency: "USD",
      subtotal: 5002.5,
      tax: 500.25,
      total: 5502.75,
      category: "consulting",
      billable: true,
      lineItems: [
        { description: "UX audit and findings", quantity: 12, unitPrice: 145, amount: 1740 },
        { description: "Design system updates", quantity: 18.5, unitPrice: 145, amount: 2682.5 },
        { description: "Stakeholder workshop", quantity: 4, unitPrice: 145, amount: 580 },
      ],
    },
    acceptable: { category: ["consulting", "professional services", "design", "services"] },
  },

  {
    id: "08-cloud-hosting-usage",
    name: "Cloud hosting with usage-style invoice, USD",
    medium: "text-layer",
    mess: ["many line items"],
    text: `CIRRUS CLOUD
Billing Statement

Account: acct_9931kd
Statement Period: 2026-02-01 to 2026-02-28
Issued: 2026-03-01

Usage                                Quantity       Rate        Amount
Compute (vCPU-hours)                  720 h      0.0312      22.46
Object storage (GB-month)             840 GB      0.023       19.32
Egress (GB)                            410 GB      0.090       36.90
Managed database (instance-month)        1         49.00       49.00

Subtotal                                             127.68
Estimated tax                                          10.21
Amount due                                            137.89`,
    truth: {
      vendor: "CIRRUS CLOUD",
      invoiceNo: "acct_9931kd",
      issueDate: "2026-03-01",
      dueDate: null,
      currency: "USD",
      subtotal: 127.68,
      tax: 10.21,
      total: 137.89,
      category: "hosting",
      billable: null,
      lineItems: [
        { description: "Compute (vCPU-hours)", quantity: 720, unitPrice: 0.0312, amount: 22.46 },
        { description: "Object storage (GB-month)", quantity: 840, unitPrice: 0.023, amount: 19.32 },
        { description: "Egress (GB)", quantity: 410, unitPrice: 0.09, amount: 36.9 },
        { description: "Managed database (instance-month)", quantity: 1, unitPrice: 49, amount: 49 },
      ],
    },
    acceptable: { category: ["hosting", "infrastructure", "cloud", "cloud hosting"] },
  },

  {
    id: "09-airline-confirmation",
    name: "Airline booking confirmation, no tax breakdown",
    medium: "text-layer",
    mess: ["prose layout", "no subtotal line"],
    text: `Booking confirmation
Reference: QK7ZP2

PASSENGER: S RIVERA
ROUTE: LHR -> LAX
DEPART: 2026-04-08
RETURN: 2026-04-15

Fare: 642.00 GBP
Taxes and carrier charges: 148.30 GBP
Total paid: 790.30 GBP

Seat 12A reserved. Fare is non-refundable.`,
    truth: {
      vendor: null,
      invoiceNo: "QK7ZP2",
      issueDate: "2026-04-08",
      dueDate: null,
      currency: "GBP",
      subtotal: 642,
      tax: 148.3,
      total: 790.3,
      category: "travel",
      billable: false,
      lineItems: [
        { description: "Fare", quantity: null, unitPrice: null, amount: 642 },
        { description: "Taxes and carrier charges", quantity: null, unitPrice: null, amount: 148.3 },
      ],
    },
    acceptable: {
      category: ["travel", "flights", "air travel", "transport"],
      issueDate: ["2026-04-08"],
    },
  },

  {
    id: "10-gym-membership",
    name: "Gym membership, minimal fields, no itemisation",
    medium: "text-layer",
    mess: ["minimal document"],
    text: `IRONWORKS GYM
Membership renewal

Member: Sam Rivera
Membership ID: IW-4471
Renewal Date: 2026-03-01
Next Due: 2026-04-01

Monthly membership    EUR 39.00`,
    truth: {
      vendor: "IRONWORKS GYM",
      invoiceNo: "IW-4471",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      currency: "EUR",
      subtotal: null,
      tax: null,
      total: 39,
      category: "health",
      billable: false,
      lineItems: [
        { description: "Monthly membership", quantity: null, unitPrice: null, amount: 39 },
      ],
    },
    acceptable: { category: ["health", "fitness", "wellness", "health and fitness"] },
  },

  {
    id: "11-legal-retainer",
    name: "Legal services invoice, USD, stamp overlap",
    medium: "image-only",
    mess: ["stamp overlap", "OCR noise", "no due date"],
    text: `HARLAN & CO LLP
Attorneys at Law

INVOICE
Invoice No: HC-2026-0219
Date of Service: 03/02/2026

Client: Rivera Design Studio

Services                                    Amount
Contract review, 4 hours                   1,800.00
Trademark filing (govt. fee)                 450.00
Courier                                     38.50

Fees                                     2,288.50
Professional charges                        900.00
TOTAL INVOICED                           3,188.50

*** PAID ***`,
    truth: {
      vendor: "HARLAN & CO LLP",
      invoiceNo: "HC-2026-0219",
      issueDate: "2026-03-02",
      dueDate: null,
      currency: "USD",
      subtotal: 2288.5,
      tax: null,
      total: 3188.5,
      category: "legal",
      billable: null,
      lineItems: [
        { description: "Contract review, 4 hours", quantity: null, unitPrice: null, amount: 1800 },
        { description: "Trademark filing (govt. fee)", quantity: null, unitPrice: null, amount: 450 },
        { description: "Courier", quantity: null, unitPrice: null, amount: 38.5 },
        { description: "Professional charges", quantity: null, unitPrice: null, amount: 900 },
      ],
    },
    acceptable: { category: ["legal", "professional services", "services", "fees"] },
  },

  {
    id: "12-freelance-client-eu",
    name: "European client invoice billed in USD, multi-currency",
    medium: "text-layer",
    mess: ["multi-currency on one document"],
    text: `MARGUERITE FONTAINE
Design Consultancy

Invoice to: Halcyon Robotics Ltd
Invoice number: MF-2026-0088
Date: 2026-05-06
Payment due: 2026-06-05

Fees in EUR: 3.200,00 EUR
Billed to client in USD at 1.0870: USD 3,478.40

Total due: USD 3,478.40

Bank details
IBAN: FR76 3000 4000 0512 3456 7890 189
BIC: AGRIFRPP889`,
    truth: {
      vendor: "MARGUERITE FONTAINE",
      invoiceNo: "MF-2026-0088",
      issueDate: "2026-05-06",
      dueDate: "2026-06-05",
      currency: "USD",
      subtotal: 3200,
      tax: null,
      total: 3478.4,
      category: "consulting",
      billable: true,
      lineItems: [
        { description: "Fees", quantity: null, unitPrice: null, amount: 3200 },
      ],
    },
    acceptable: {
      category: ["consulting", "professional services", "design", "services"],
      total: [3478.4, 3200],
    },
  },

  {
    id: "13-coffee-shop",
    name: "Very small receipt, no tax, minimal text",
    medium: "text-layer",
    mess: ["tiny document"],
    text: `BLUE BOTTLE
1 Ferry Building

2026-02-11

1x Drip coffee        4.25
1x Almond croissant   5.50

TOTAL                 9.75`,
    truth: {
      vendor: "BLUE BOTTLE",
      invoiceNo: null,
      issueDate: "2026-02-11",
      dueDate: null,
      currency: "USD",
      subtotal: null,
      tax: null,
      total: 9.75,
      category: "meals",
      billable: false,
      lineItems: [
        { description: "Drip coffee", quantity: 1, unitPrice: null, amount: 4.25 },
        { description: "Almond croissant", quantity: 1, unitPrice: null, amount: 5.5 },
      ],
    },
    acceptable: { category: ["meals", "food", "coffee", "dining"] },
  },

  {
    id: "14-domain-registration",
    name: "Domain and DNS renewal, multi-year, USD",
    medium: "text-layer",
    mess: ["multi-year quantity"],
    text: `HOLLOWAY DOMAINS
Domain Registration Invoice

Invoice #: HD-2026-7734
Date: 2026-01-09

DOMAIN              TLD      YEARS     UNIT        AMOUNT
ledgerline          tech     2        34.00       68.00
studio-site         com      2        14.00       28.00

Subtotal                                96.00
Tax                                      0.00
TOTAL                                  96.00 USD

Renewal reminders will be sent 30 days prior.`,
    truth: {
      vendor: "HOLLOWAY DOMAINS",
      invoiceNo: "HD-2026-7734",
      issueDate: "2026-01-09",
      dueDate: null,
      currency: "USD",
      subtotal: 96,
      tax: 0,
      total: 96,
      category: "software",
      billable: null,
      lineItems: [
        { description: "ledgerline.tech", quantity: 2, unitPrice: 34, amount: 68 },
        { description: "studio-site.com", quantity: 2, unitPrice: 14, amount: 28 },
      ],
    },
    acceptable: { category: ["software", "domains", "web hosting", "hosting"] },
  },

  {
    id: "15-insurance-premium",
    name: "Professional indemnity insurance, GBP, annual",
    medium: "image-only",
    mess: ["low contrast", "dense prose"],
    text: `MERIDIAN INSURANCE
Professional Indemnity - Policy Schedule

Policy Number: MI-PI-88213
Policy Period: 15/02/2026 to 14/02/2027
Date of Invoice: 20/01/2026

Insured: Rivera Design Studio Ltd
Limit of Indemnity: GBP 2,000,000

Premium for the policy period          GBP 612.00
Insurance Premium Tax (IPT) 12%         GBP 73.44
Total Payable                         GBP 685.44

Payment due 45 days from invoice date.`,
    truth: {
      vendor: "MERIDIAN INSURANCE",
      invoiceNo: "MI-PI-88213",
      issueDate: "2026-01-20",
      dueDate: "2026-03-06",
      currency: "GBP",
      subtotal: 612,
      tax: 73.44,
      total: 685.44,
      category: "insurance",
      billable: false,
      lineItems: [
        { description: "Premium for the policy period", quantity: null, unitPrice: null, amount: 612 },
      ],
    },
    acceptable: { category: ["insurance", "professional indemnity", "insurance and fees"] },
  },

  {
    id: "16-translation-services",
    name: "Freelance services invoice, USD, per-word rates",
    medium: "text-layer",
    mess: ["per-word unit rates"],
    text: `J. OKONKWO TRANSLATIONS
Certified translator (FR-DE)

Statement for services rendered
Statement No: JOT-1182
Rendered: 2026-02-26
Client: Rivera Design Studio

Description                    Units        Rate        Amount
Certified translation           4,200 w    0.115       483.00
Editing pass                      1 doc    0.09         90.00
Certified copy                   1 doc     25.00        25.00

Subtotal                                            598.00
Sales tax 0%                                          0.00
TOTAL                                              598.00 USD`,
    truth: {
      vendor: "J. OKONKWO TRANSLATIONS",
      invoiceNo: "JOT-1182",
      issueDate: "2026-02-26",
      dueDate: null,
      currency: "USD",
      subtotal: 598,
      tax: 0,
      total: 598,
      category: "services",
      billable: null,
      lineItems: [
        { description: "Certified translation", quantity: 4200, unitPrice: 0.115, amount: 483 },
        { description: "Editing pass", quantity: 1, unitPrice: 0.09, amount: 90 },
        { description: "Certified copy", quantity: 1, unitPrice: 25, amount: 25 },
      ],
    },
    acceptable: { category: ["services", "consulting", "professional services", "translation"] },
  },

  {
    id: "17-mobile-phone",
    name: "Mobile phone bill, EUR, prorated charges",
    medium: "text-layer",
    mess: ["prorated lines", "negative credit"],
    text: `TELIA MOBIL
Rechnung

Kundennummer: 55-2290114
Rechnungsdatum: 01.03.2026
Rechnungsnummer: RM-2026-330871

Grundpreis (01.03.-31.03.)              29,90 EUR
Daten (12,4 GB)                          9,90 EUR
Roaming EU                              4,20 EUR
Gutschrift Vorperiode                    -3,50 EUR

Zwischensumme                            40,50 EUR
MwSt 19%                                  6,42 EUR
Rechnungsbetrag                         46,92 EUR

Automatische Zahlung im April.`,
    truth: {
      vendor: "TELIA MOBIL",
      invoiceNo: "RM-2026-330871",
      issueDate: "2026-03-01",
      dueDate: null,
      currency: "EUR",
      subtotal: 40.5,
      tax: 6.42,
      total: 46.92,
      category: "utilities",
      billable: false,
      lineItems: [
        { description: "Grundpreis", quantity: null, unitPrice: null, amount: 29.9 },
        { description: "Daten", quantity: null, unitPrice: null, amount: 9.9 },
        { description: "Roaming EU", quantity: null, unitPrice: null, amount: 4.2 },
        { description: "Gutschrift Vorperiode", quantity: null, unitPrice: null, amount: -3.5 },
      ],
    },
    acceptable: { category: ["utilities", "telecom", "phone", "mobile"] },
  },

  {
    id: "18-print-shop",
    name: "Print shop invoice, low contrast scan, rotated",
    medium: "image-only",
    mess: ["rotated scan", "low contrast", "OCR noise", "no currency symbol"],
    text: `[scan, rotated ~4 degrees, low contrast]

INKWELL PRINT SHOP
21 Greyfriars Road

ORDER #1P-8842
Date 07.03.2026

Business cards - 500gsm     250 off   180.00
Letterheads - A4             200 off   140.00
Envelopes - C5               100 off    55.00
Lamination                    50 off    25.00

Subtotal                                  400.00
VAT 20%                                    80.00
TOTAL                                     480.00`,
    truth: {
      vendor: "INKWELL PRINT SHOP",
      invoiceNo: "1P-8842",
      issueDate: "2026-03-07",
      dueDate: null,
      currency: null,
      subtotal: 400,
      tax: 80,
      total: 480,
      category: "printing",
      billable: null,
      lineItems: [
        { description: "Business cards - 500gsm", quantity: 250, unitPrice: null, amount: 180 },
        { description: "Letterheads - A4", quantity: 200, unitPrice: null, amount: 140 },
        { description: "Envelopes - C5", quantity: 100, unitPrice: null, amount: 55 },
        { description: "Lamination", quantity: 50, unitPrice: null, amount: 25 },
      ],
    },
    acceptable: {
      category: ["printing", "services", "office supplies", "marketing"],
    },
  },

  {
    id: "19-missing-total-row",
    name: "Total row absent, sum implied only",
    medium: "text-layer",
    mess: ["missing total row"],
    text: `QUARRY COFFEE ROASTERS
Wholesale invoice

Account 4471-B
Roasted 2026-03-10

Product                      Kg      Rate/kg    Amount
Ethiopia Yirgacheffe          6       22.00     132.00
Colombia Huila                6       19.50     117.00

Net amount                             249.00`,
    truth: {
      vendor: "QUARRY COFFEE ROASTERS",
      invoiceNo: "4471-B",
      issueDate: "2026-03-10",
      dueDate: null,
      currency: null,
      subtotal: 249,
      tax: null,
      total: null,
      category: "supplies",
      billable: false,
      lineItems: [
        { description: "Ethiopia Yirgacheffe", quantity: 6, unitPrice: 22, amount: 132 },
        { description: "Colombia Huila", quantity: 6, unitPrice: 19.5, amount: 117 },
      ],
    },
    acceptable: { category: ["supplies", "coffee", "food", "inventory"] },
  },

  {
    id: "20-international-consulting",
    name: "International invoice, USD billed, EUR entity, itemised in words",
    medium: "text-layer",
    mess: ["mixed-script entity name", "amount in words"],
    text: `ATELIER VERTE SARL
14 rue Beaubourg, 75004 Paris, France

FACTURE N 2026-AV-0331
Date de facture: 2026-02-05
Echeance: 2026-03-07

Client: Halcyon Robotics Ltd

Design retainer, February 2026
  Research and discovery phase ........ 2,900.00 EUR
  Interaction design .................. 4,150.00 EUR
  Prototype build .................... 1,950.00 EUR

Total HT .............................. 9,000.00 EUR
TVA 20% ............................... 1,800.00 EUR
Total TTC ............................. 10,800.00 EUR

Amount in words: Ten thousand eight hundred euro.`,
    truth: {
      vendor: "ATELIER VERTE SARL",
      invoiceNo: "2026-AV-0331",
      issueDate: "2026-02-05",
      dueDate: "2026-03-07",
      currency: "EUR",
      subtotal: 9000,
      tax: 1800,
      total: 10800,
      category: "consulting",
      billable: true,
      lineItems: [
        { description: "Research and discovery phase", quantity: null, unitPrice: null, amount: 2900 },
        { description: "Interaction design", quantity: null, unitPrice: null, amount: 4150 },
        { description: "Prototype build", quantity: null, unitPrice: null, amount: 1950 },
      ],
    },
    acceptable: { category: ["consulting", "design", "professional services", "services"] },
  },
]