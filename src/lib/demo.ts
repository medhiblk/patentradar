import type { Profile } from "./model";
import type { PatentRecord } from "./providers/types";
export const demoText =
  "SYNTHETIC INDUSTRIAL MANUAL — OptiFlow 200. An automated laboratory instrument transports liquid samples using a microfluidic pump. An optical detector measures fluorescence in a flow cell. A temperature controller regulates the reaction chamber. Software calibrates detector signals and flags measurement drift.";
export const demoProfile: Profile = {
  title: "OptiFlow automated analysis instrument",
  domain: "Industrial laboratory instrumentation",
  operatingPrinciple:
    "Microfluidic sample transport followed by temperature-controlled optical measurement.",
  technicalFeatures: [
    {
      name: "Microfluidic sample handling",
      description: "A pump transports liquid samples through a flow cell.",
    },
    {
      name: "Optical fluorescence detection",
      description: "An optical detector measures fluorescence from a sample.",
    },
    {
      name: "Temperature control",
      description: "A controller regulates the reaction chamber temperature.",
    },
    {
      name: "Signal calibration software",
      description: "Software calibrates detector signals and flags drift.",
    },
  ],
  searchKeywords: [
    "microfluidic optical fluorescence detection",
    "automated sample handling",
    "temperature controlled flow cell",
  ],
};
export function demoPatents(): PatentRecord[] {
  return [
    {
      id: "demo-optical",
      publicationNumber: "DEMO-OPTICAL-01",
      title: "Synthetic optical flow-cell analysis system",
      abstract:
        "An optical detector measures fluorescence in a microfluidic flow cell. A pump transports liquid samples to the detector.",
      applicants: ["Synthetic Optics Lab"],
      jurisdiction: "DEMO",
      publicationDate: "2024-01-01",
      claims: [
        "SYNTHETIC CLAIM: An instrument comprising a microfluidic pump, a flow cell and an optical fluorescence detector.",
      ],
      source: "Synthetic demo fixture — not a patent",
      sourceUrl: "https://example.org/synthetic-demo",
      retrievedAt: new Date().toISOString(),
      synthetic: true,
    },
    {
      id: "demo-thermal",
      publicationNumber: "DEMO-THERMAL-02",
      title: "Synthetic temperature-regulated sample processing",
      abstract:
        "A temperature controller regulates a reaction chamber during sample processing. Software calibrates temperature signals.",
      applicants: ["Synthetic Process Instruments"],
      jurisdiction: "DEMO",
      publicationDate: "2023-06-01",
      source: "Synthetic demo fixture — not a patent",
      sourceUrl: "https://example.org/synthetic-demo",
      retrievedAt: new Date().toISOString(),
      synthetic: true,
    },
  ];
}
