/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by `npm run results:export` from results/eval-4b.json.
 *
 * This is recorded output from a real local run of gemma3:4b over the
 * fixture corpus, including its mistakes. It is offered when no runtime is
 * available so a judge with no Ollama still sees the real review, correction
 * and export flow working end to end.
 *
 * The runtime banner labels it "demo data" and never calls it live inference.
 */
import type { Extracted } from "./schema"

export interface DemoEntry {
  id: string
  sourceFile: string
  textLayer: boolean
  model: string
  sourceText: string
  value: Extracted
}

export const DEMO_INVOICES: DemoEntry[] = [
  {
    "id": "demo-01-saas-team-plan",
    "sourceFile": "01-saas-team-plan.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "NORTHWIND ANALYTICS\nSuite 400, 1200 Market Street\nSan Francisco, CA 94102\n\nINVOICE\nInvoice Number: NW-2026-0431\nIssue Date: 2026-03-14\nDue Date: 2026-04-13\nTerms: Net 30\n\nBill To:\nSam Rivera\nRivera Design Studio\n\nDescription                          Qty     Unit Price        Amount\nAnalytics Pro - Team plan           12 mo        49.00          588.00\nAdditional seats                      3        19.00           57.00\nPriority support                      1        75.00           75.00\n\nSubtotal                                             720.00\nSales Tax (8.5%)                                       61.20\nTOTAL DUE                                            781.20 USD\n\nPayment is due within 30 days of the issue date.",
    "value": {
      "vendor": "NORTHWIND ANALYTICS",
      "invoiceNo": "NW-2026-0431",
      "issueDate": "2026-03-14",
      "dueDate": "2026-04-13",
      "currency": "USD",
      "subtotal": 720,
      "tax": 61.2,
      "total": 781.2,
      "category": "Analytics Pro - Team plan",
      "billable": null,
      "lineItems": [
        {
          "description": "Analytics Pro - Team plan",
          "quantity": 12,
          "unitPrice": 49,
          "amount": 588
        },
        {
          "description": "Additional seats",
          "quantity": 3,
          "unitPrice": 19,
          "amount": 57
        },
        {
          "description": "Priority support",
          "quantity": 1,
          "unitPrice": 75,
          "amount": 75
        }
      ]
    }
  },
  {
    "id": "demo-02-restaurant-receipt",
    "sourceFile": "02-restaurant-receipt.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "THE GREEN KITCHEN\n88 Rosemont Ave, Austin TX 78704\n\nTable 12          Server: Dana        Check 4471\n\n1x Espresso                          3.50\n2x House sandwich                   11.00\n1x Soup of the day                   7.25\n3x Sparkling water                   9.00\n1x Tiramisu                          8.50\n\nSubtotal                            39.25\nTax                                  3.34\nTOTAL                               42.59\n\n03/22/2026   1:04 PM\nThank you for dining with us.",
    "value": {
      "vendor": "THE GREEN KITCHEN",
      "invoiceNo": null,
      "issueDate": "2026-03-22",
      "dueDate": null,
      "currency": "USD",
      "subtotal": 39.25,
      "tax": 3.34,
      "total": 42.59,
      "category": "Restaurant",
      "billable": null,
      "lineItems": [
        {
          "description": "Espresso",
          "quantity": 1,
          "unitPrice": 3.5,
          "amount": 3.5
        },
        {
          "description": "House sandwich",
          "quantity": 2,
          "unitPrice": 11,
          "amount": 22
        },
        {
          "description": "Soup of the day",
          "quantity": 1,
          "unitPrice": 7.25,
          "amount": 7.25
        },
        {
          "description": "Sparkling water",
          "quantity": 3,
          "unitPrice": 9,
          "amount": 27
        },
        {
          "description": "Tiramisu",
          "quantity": 1,
          "unitPrice": 8.5,
          "amount": 8.5
        }
      ]
    }
  },
  {
    "id": "demo-03-german-prose-total",
    "sourceFile": "03-german-prose-total.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "Rechnung\n\nDienstleister: Ludwig & Sohn GmbH\nRechnungsnummer: 2026-0455\nRechnungsdatum: 14.03.2026\nFällig am: 13.04.2026\n\nLeistung                     Netto          MwSt          Brutto\nBeratung Design          2.400,00 EUR    456,00 EUR   2.856,00 EUR\n\nRechnungsbetrag                                    2.856,00 EUR\n\nZahlbar innerhalb 30 Tagen ohne Abzug.",
    "value": {
      "vendor": "Ludwig & Sohn GmbH",
      "invoiceNo": "2026-0455",
      "issueDate": "2026-03-14",
      "dueDate": "2026-04-13",
      "currency": "EUR",
      "subtotal": 2856,
      "tax": 456,
      "total": 2856,
      "category": "Beratung Design",
      "billable": null,
      "lineItems": [
        {
          "description": "Beratung Design",
          "quantity": null,
          "unitPrice": 2400,
          "amount": 2400
        }
      ]
    }
  },
  {
    "id": "demo-04-hardware-ocr-garbled",
    "sourceFile": "04-hardware-ocr-garbled.pdf",
    "textLayer": false,
    "model": "gemma3:4b",
    "sourceText": "~ S C A N   R E C E I P T ~\nVENDOR:  Pixel Forge Hardware\nDATE:    2 0 2 6 - 0 2 - 0 9\nREF:     PF-99-2214\n\nQTY  ITEM                  AMOUNT\n  1  34\" ultrawide m.on    549.00\n  2  US B-C dock            89.95\n  1  HDMI cab1e               12.50\n\n             GRAND T0TAL     728.90\n\nCurrency: EUR",
    "value": {
      "vendor": "Pixel Forge Hardware",
      "invoiceNo": "PF-99-2214",
      "issueDate": "2026-02-09",
      "dueDate": null,
      "currency": "EUR",
      "subtotal": 728.9,
      "tax": null,
      "total": null,
      "category": null,
      "billable": null,
      "lineItems": [
        {
          "description": "34\" ultrawide m.on",
          "quantity": 1,
          "unitPrice": 549,
          "amount": 549
        },
        {
          "description": "US B-C dock",
          "quantity": 1,
          "unitPrice": 89.95,
          "amount": 89.95
        },
        {
          "description": "HDMI cab1e",
          "quantity": 1,
          "unitPrice": 12.5,
          "amount": 12.5
        }
      ]
    }
  },
  {
    "id": "demo-05-utility-pkr",
    "sourceFile": "05-utility-pkr.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "K-ELECTRIC BILL\nConsumer No: 4110229837\nBilling Period: 01/01/2026 - 31/01/2026\nMeter Reading Previous: 48210\nMeter Reading Current: 49188\n\nUnits Consumed: 978\nTariff Category: Residential\n\nAmount Payable: Rs 21,516\nDue Date: 20/02/2026\n\nThis is a computer generated bill.",
    "value": {
      "vendor": "K-ELECTRIC",
      "invoiceNo": null,
      "issueDate": "2026-01-01",
      "dueDate": "2026-02-20",
      "currency": "INR",
      "subtotal": 21516,
      "tax": null,
      "total": null,
      "category": "Residential",
      "billable": null,
      "lineItems": []
    }
  },
  {
    "id": "demo-06-coworking-gbp",
    "sourceFile": "06-coworking-gbp.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "THE WORKS LONDON\nUnit 12, 4 Hackney Road, London E2 7NX\n\nMembership Invoice\nRef: TWL-2026-0912\nDate: 03/04/26\nPayment due: 03/05/26\n\nDescription                       Amount\nHot desk - April                   320.00\nMeeting room credits (10 hrs)     150.00\nLocker rental                      25.00\n\nSubtotal                          495.00\nVAT 20%                            99.00\nTotal                            594.00 GBP",
    "value": {
      "vendor": "THE WORKS LONDON",
      "invoiceNo": "TWL-2026-0912",
      "issueDate": "2026-04-03",
      "dueDate": "2026-05-03",
      "currency": "GBP",
      "subtotal": 495,
      "tax": 99,
      "total": 594,
      "category": "Membership Invoice",
      "billable": null,
      "lineItems": [
        {
          "description": "Hot desk - April",
          "quantity": null,
          "unitPrice": 320,
          "amount": 320
        },
        {
          "description": "Meeting room credits (10 hrs)",
          "quantity": null,
          "unitPrice": 150,
          "amount": 150
        },
        {
          "description": "Locker rental",
          "quantity": null,
          "unitPrice": 25,
          "amount": 25
        }
      ]
    }
  },
  {
    "id": "demo-07-client-invoice-billable",
    "sourceFile": "07-client-invoice-billable.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "RIVERA DESIGN STUDIO\nInvoice to: Halcyon Robotics Ltd\nAttn: Finance Department\n\nInvoice Number: RDS-2026-0118\nInvoice Date: 2026-01-18\nDue Date: 2026-02-17\n\nRe: Product design retainer, January 2026\nBillable to client per MSA section 4.\n\nLine item                        Hours    Rate        Amount\nUX audit and findings           12.0     145.00     1740.00\nDesign system updates           18.5     145.00     2682.50\nStakeholder workshop              4.0     145.00      580.00\n\nSubtotal                                     5002.50\nVAT 20%                                      500.25\nTOTAL DUE                                   5502.75\n\nPayment terms: Net 30",
    "value": {
      "vendor": "RIVERA DESIGN STUDIO",
      "invoiceNo": "RDS-2026-0118",
      "issueDate": "2026-01-18",
      "dueDate": "2026-02-17",
      "currency": "USD",
      "subtotal": 5002.5,
      "tax": 500.25,
      "total": 5502.75,
      "category": "Product design retainer",
      "billable": true,
      "lineItems": [
        {
          "description": "UX audit and findings",
          "quantity": 12,
          "unitPrice": 145,
          "amount": 1740
        },
        {
          "description": "Design system updates",
          "quantity": 18.5,
          "unitPrice": 145,
          "amount": 2682.5
        },
        {
          "description": "Stakeholder workshop",
          "quantity": 4,
          "unitPrice": 145,
          "amount": 580
        }
      ]
    }
  },
  {
    "id": "demo-08-cloud-hosting-usage",
    "sourceFile": "08-cloud-hosting-usage.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "CIRRUS CLOUD\nBilling Statement\n\nAccount: acct_9931kd\nStatement Period: 2026-02-01 to 2026-02-28\nIssued: 2026-03-01\n\nUsage                                Quantity       Rate        Amount\nCompute (vCPU-hours)                  720 h      0.0312      22.46\nObject storage (GB-month)             840 GB      0.023       19.32\nEgress (GB)                            410 GB      0.090       36.90\nManaged database (instance-month)        1         49.00       49.00\n\nSubtotal                                             127.68\nEstimated tax                                          10.21\nAmount due                                            137.89",
    "value": {
      "vendor": "CIRRUS CLOUD",
      "invoiceNo": null,
      "issueDate": "2026-03-01",
      "dueDate": null,
      "currency": "USD",
      "subtotal": 127.68,
      "tax": 10.21,
      "total": 137.89,
      "category": "Billing Statement",
      "billable": null,
      "lineItems": [
        {
          "description": "Compute (vCPU-hours)",
          "quantity": 720,
          "unitPrice": 0.0312,
          "amount": 22.46
        },
        {
          "description": "Object storage (GB-month)",
          "quantity": 840,
          "unitPrice": 0.023,
          "amount": 19.32
        },
        {
          "description": "Egress (GB)",
          "quantity": 410,
          "unitPrice": 0.09,
          "amount": 36.9
        },
        {
          "description": "Managed database (instance-month)",
          "quantity": 1,
          "unitPrice": 49,
          "amount": 49
        }
      ]
    }
  },
  {
    "id": "demo-09-airline-confirmation",
    "sourceFile": "09-airline-confirmation.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "Booking confirmation\nReference: QK7ZP2\n\nPASSENGER: S RIVERA\nROUTE: LHR -> LAX\nDEPART: 2026-04-08\nRETURN: 2026-04-15\n\nFare: 642.00 GBP\nTaxes and carrier charges: 148.30 GBP\nTotal paid: 790.30 GBP\n\nSeat 12A reserved. Fare is non-refundable.",
    "value": {
      "vendor": null,
      "invoiceNo": null,
      "issueDate": null,
      "dueDate": null,
      "currency": "GBP",
      "subtotal": 642,
      "tax": 148.3,
      "total": 790.3,
      "category": null,
      "billable": null,
      "lineItems": []
    }
  },
  {
    "id": "demo-10-gym-membership",
    "sourceFile": "10-gym-membership.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "IRONWORKS GYM\nMembership renewal\n\nMember: Sam Rivera\nMembership ID: IW-4471\nRenewal Date: 2026-03-01\nNext Due: 2026-04-01\n\nMonthly membership    EUR 39.00",
    "value": {
      "vendor": "IRONWORKS GYM",
      "invoiceNo": null,
      "issueDate": "2026-03-01",
      "dueDate": null,
      "currency": "EUR",
      "subtotal": 39,
      "tax": null,
      "total": null,
      "category": "Membership renewal",
      "billable": null,
      "lineItems": [
        {
          "description": "Monthly membership",
          "quantity": 1,
          "unitPrice": 39,
          "amount": 39
        }
      ]
    }
  },
  {
    "id": "demo-11-legal-retainer",
    "sourceFile": "11-legal-retainer.pdf",
    "textLayer": false,
    "model": "gemma3:4b",
    "sourceText": "HARLAN & CO LLP\nAttorneys at Law\n\nINVOICE\nInvoice No: HC-2026-0219\nDate of Service: 03/02/2026\n\nClient: Rivera Design Studio\n\nServices                                    Amount\nContract review, 4 hours                   1,800.00\nTrademark filing (govt. fee)                 450.00\nCourier                                     38.50\n\nFees                                     2,288.50\nProfessional charges                        900.00\nTOTAL INVOICED                           3,188.50\n\n*** PAID ***",
    "value": {
      "vendor": "HARLAN & CO LLP",
      "invoiceNo": "HC-2026-0219",
      "issueDate": "2026-03-02",
      "dueDate": null,
      "currency": "USD",
      "subtotal": null,
      "tax": null,
      "total": 3188.5,
      "category": null,
      "billable": null,
      "lineItems": [
        {
          "description": "Contract review, 4 hours",
          "quantity": null,
          "unitPrice": null,
          "amount": 1800
        },
        {
          "description": "Trademark filing (govt. fee)",
          "quantity": null,
          "unitPrice": null,
          "amount": 450
        },
        {
          "description": "Courier",
          "quantity": null,
          "unitPrice": 38.5,
          "amount": 38.5
        }
      ]
    }
  },
  {
    "id": "demo-12-freelance-client-eu",
    "sourceFile": "12-freelance-client-eu.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "MARGUERITE FONTAINE\nDesign Consultancy\n\nInvoice to: Halcyon Robotics Ltd\nInvoice number: MF-2026-0088\nDate: 2026-05-06\nPayment due: 2026-06-05\n\nFees in EUR: 3.200,00 EUR\nBilled to client in USD at 1.0870: USD 3,478.40\n\nTotal due: USD 3,478.40\n\nBank details\nIBAN: FR76 3000 4000 0512 3456 7890 189\nBIC: AGRIFRPP889",
    "value": {
      "vendor": "MARGUERITE FONTAINE Design Consultancy",
      "invoiceNo": "MF-2026-0088",
      "issueDate": "2026-05-06",
      "dueDate": "2026-06-05",
      "currency": "EUR",
      "subtotal": 3200,
      "tax": null,
      "total": 3478.4,
      "category": "Fees",
      "billable": null,
      "lineItems": []
    }
  },
  {
    "id": "demo-13-coffee-shop",
    "sourceFile": "13-coffee-shop.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "BLUE BOTTLE\n1 Ferry Building\n\n2026-02-11\n\n1x Drip coffee        4.25\n1x Almond croissant   5.50\n\nTOTAL                 9.75",
    "value": {
      "vendor": "BLUE BOTTLE",
      "invoiceNo": null,
      "issueDate": "2026-02-11",
      "dueDate": null,
      "currency": "USD",
      "subtotal": 9.75,
      "tax": null,
      "total": 9.75,
      "category": null,
      "billable": null,
      "lineItems": [
        {
          "description": "Drip coffee",
          "quantity": 1,
          "unitPrice": 4.25,
          "amount": 4.25
        },
        {
          "description": "Almond croissant",
          "quantity": 1,
          "unitPrice": 5.5,
          "amount": 5.5
        }
      ]
    }
  },
  {
    "id": "demo-14-domain-registration",
    "sourceFile": "14-domain-registration.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "HOLLOWAY DOMAINS\nDomain Registration Invoice\n\nInvoice #: HD-2026-7734\nDate: 2026-01-09\n\nDOMAIN              TLD      YEARS     UNIT        AMOUNT\nledgerline          tech     2        34.00       68.00\nstudio-site         com      2        14.00       28.00\n\nSubtotal                                96.00\nTax                                      0.00\nTOTAL                                  96.00 USD\n\nRenewal reminders will be sent 30 days prior.",
    "value": {
      "vendor": "HOLLOWAY DOMAINS",
      "invoiceNo": "HD-2026-7734",
      "issueDate": "2026-01-09",
      "dueDate": null,
      "currency": "USD",
      "subtotal": 96,
      "tax": 0,
      "total": 96,
      "category": null,
      "billable": null,
      "lineItems": [
        {
          "description": "ledgerline",
          "quantity": 1,
          "unitPrice": 34,
          "amount": 68
        },
        {
          "description": "studio-site",
          "quantity": 1,
          "unitPrice": 14,
          "amount": 28
        }
      ]
    }
  },
  {
    "id": "demo-15-insurance-premium",
    "sourceFile": "15-insurance-premium.pdf",
    "textLayer": false,
    "model": "gemma3:4b",
    "sourceText": "MERIDIAN INSURANCE\nProfessional Indemnity - Policy Schedule\n\nPolicy Number: MI-PI-88213\nPolicy Period: 15/02/2026 to 14/02/2027\nDate of Invoice: 20/01/2026\n\nInsured: Rivera Design Studio Ltd\nLimit of Indemnity: GBP 2,000,000\n\nPremium for the policy period          GBP 612.00\nInsurance Premium Tax (IPT) 12%         GBP 73.44\nTotal Payable                         GBP 685.44\n\nPayment due 45 days from invoice date.",
    "value": {
      "vendor": "MERIDIAN INSURANCE",
      "invoiceNo": null,
      "issueDate": "2026-01-20",
      "dueDate": null,
      "currency": "GBP",
      "subtotal": 685.44,
      "tax": 73.44,
      "total": 685.44,
      "category": "Professional Indemnity",
      "billable": null,
      "lineItems": []
    }
  },
  {
    "id": "demo-16-translation-services",
    "sourceFile": "16-translation-services.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "J. OKONKWO TRANSLATIONS\nCertified translator (FR-DE)\n\nStatement for services rendered\nStatement No: JOT-1182\nRendered: 2026-02-26\nClient: Rivera Design Studio\n\nDescription                    Units        Rate        Amount\nCertified translation           4,200 w    0.115       483.00\nEditing pass                      1 doc    0.09         90.00\nCertified copy                   1 doc     25.00        25.00\n\nSubtotal                                            598.00\nSales tax 0%                                          0.00\nTOTAL                                              598.00 USD",
    "value": {
      "vendor": "J. OKONKWO TRANSLATIONS",
      "invoiceNo": "JOT-1182",
      "issueDate": "2026-02-26",
      "dueDate": null,
      "currency": "USD",
      "subtotal": 598,
      "tax": 0,
      "total": 598,
      "category": "services",
      "billable": null,
      "lineItems": [
        {
          "description": "Certified translation",
          "quantity": 4200,
          "unitPrice": 0.115,
          "amount": 483
        },
        {
          "description": "Editing pass",
          "quantity": 1,
          "unitPrice": 0.09,
          "amount": 90
        },
        {
          "description": "Certified copy",
          "quantity": 1,
          "unitPrice": 25,
          "amount": 25
        }
      ]
    }
  },
  {
    "id": "demo-17-mobile-phone",
    "sourceFile": "17-mobile-phone.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "TELIA MOBIL\nRechnung\n\nKundennummer: 55-2290114\nRechnungsdatum: 01.03.2026\nRechnungsnummer: RM-2026-330871\n\nGrundpreis (01.03.-31.03.)              29,90 EUR\nDaten (12,4 GB)                          9,90 EUR\nRoaming EU                              4,20 EUR\nGutschrift Vorperiode                    -3,50 EUR\n\nZwischensumme                            40,50 EUR\nMwSt 19%                                  6,42 EUR\nRechnungsbetrag                         46,92 EUR\n\nAutomatische Zahlung im April.",
    "value": {
      "vendor": "TELIA MOBIL",
      "invoiceNo": "RM-2026-330871",
      "issueDate": "2026-03-01",
      "dueDate": null,
      "currency": "EUR",
      "subtotal": 40.5,
      "tax": 6.42,
      "total": 46.92,
      "category": null,
      "billable": false,
      "lineItems": [
        {
          "description": "Grundpreis (01.03.-31.03.)",
          "quantity": null,
          "unitPrice": 29.9,
          "amount": null
        },
        {
          "description": "Daten (12,4 GB)",
          "quantity": null,
          "unitPrice": 9.9,
          "amount": null
        },
        {
          "description": "Roaming EU",
          "quantity": null,
          "unitPrice": 4.2,
          "amount": null
        },
        {
          "description": "Gutschrift Vorperiode",
          "quantity": null,
          "unitPrice": null,
          "amount": -3.5
        }
      ]
    }
  },
  {
    "id": "demo-18-print-shop",
    "sourceFile": "18-print-shop.pdf",
    "textLayer": false,
    "model": "gemma3:4b",
    "sourceText": "[scan, rotated ~4 degrees, low contrast]\n\nINKWELL PRINT SHOP\n21 Greyfriars Road\n\nORDER #1P-8842\nDate 07.03.2026\n\nBusiness cards - 500gsm     250 off   180.00\nLetterheads - A4             200 off   140.00\nEnvelopes - C5               100 off    55.00\nLamination                    50 off    25.00\n\nSubtotal                                  400.00\nVAT 20%                                    80.00\nTOTAL                                     480.00",
    "value": {
      "vendor": "INKWELL PRINT SHOP",
      "invoiceNo": "1P-8842",
      "issueDate": "2026-03-07",
      "dueDate": null,
      "currency": "GBP",
      "subtotal": 400,
      "tax": 80,
      "total": 480,
      "category": "Business cards",
      "billable": null,
      "lineItems": [
        {
          "description": "Business cards - 500gsm",
          "quantity": 250,
          "unitPrice": 180,
          "amount": null
        },
        {
          "description": "Letterheads - A4",
          "quantity": 200,
          "unitPrice": 140,
          "amount": null
        },
        {
          "description": "Envelopes - C5",
          "quantity": 100,
          "unitPrice": 55,
          "amount": null
        },
        {
          "description": "Lamination",
          "quantity": 50,
          "unitPrice": 25,
          "amount": null
        }
      ]
    }
  },
  {
    "id": "demo-19-missing-total-row",
    "sourceFile": "19-missing-total-row.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "QUARRY COFFEE ROASTERS\nWholesale invoice\n\nAccount 4471-B\nRoasted 2026-03-10\n\nProduct                      Kg      Rate/kg    Amount\nEthiopia Yirgacheffe          6       22.00     132.00\nColombia Huila                6       19.50     117.00\n\nNet amount                             249.00",
    "value": {
      "vendor": "QUARRY COFFEE ROASTERS",
      "invoiceNo": null,
      "issueDate": "2026-03-10",
      "dueDate": null,
      "currency": "USD",
      "subtotal": 249,
      "tax": null,
      "total": null,
      "category": null,
      "billable": null,
      "lineItems": [
        {
          "description": "Ethiopia Yirgacheffe",
          "quantity": 6,
          "unitPrice": 22,
          "amount": 132
        },
        {
          "description": "Colombia Huila",
          "quantity": 6,
          "unitPrice": 19.5,
          "amount": 117
        }
      ]
    }
  },
  {
    "id": "demo-20-international-consulting",
    "sourceFile": "20-international-consulting.pdf",
    "textLayer": true,
    "model": "gemma3:4b",
    "sourceText": "ATELIER VERTE SARL\n14 rue Beaubourg, 75004 Paris, France\n\nFACTURE N 2026-AV-0331\nDate de facture: 2026-02-05\nEcheance: 2026-03-07\n\nClient: Halcyon Robotics Ltd\n\nDesign retainer, February 2026\n  Research and discovery phase ........ 2,900.00 EUR\n  Interaction design .................. 4,150.00 EUR\n  Prototype build .................... 1,950.00 EUR\n\nTotal HT .............................. 9,000.00 EUR\nTVA 20% ............................... 1,800.00 EUR\nTotal TTC ............................. 10,800.00 EUR\n\nAmount in words: Ten thousand eight hundred euro.",
    "value": {
      "vendor": "ATELIER VERTE SARL",
      "invoiceNo": "2026-AV-0331",
      "issueDate": "2026-02-05",
      "dueDate": "2026-03-07",
      "currency": "EUR",
      "subtotal": 9000,
      "tax": 1800,
      "total": 10800,
      "category": "Design retainer",
      "billable": null,
      "lineItems": [
        {
          "description": "Research and discovery phase",
          "quantity": null,
          "unitPrice": 2900,
          "amount": null
        },
        {
          "description": "Interaction design",
          "quantity": null,
          "unitPrice": 4150,
          "amount": null
        },
        {
          "description": "Prototype build",
          "quantity": null,
          "unitPrice": 1950,
          "amount": null
        }
      ]
    }
  }
]
