/**
 * Portfolio data: profile and project list.
 * Edit name, bio, resume URL, and links here.
 */

export interface PortfolioProject {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  route: string;
  externalUrl?: string;
}

export interface PortfolioProfile {
  name: string;
  tagline: string;
  bio: string;
  resumeUrl: string;
  email?: string;
  github?: string;
  linkedin?: string;
}

export const profile: PortfolioProfile = {
  name: "Hengky Edyson",
  tagline: "Developer · Building tools that matter",
  bio: "I build mobile and web applications with a focus on real-world usability. This portfolio showcases projects ranging from point-of-sale systems to integrations with hardware and messaging platforms.",
  resumeUrl: "#", // Replace with your resume PDF or URL, or use "#" for "coming soon"
  email: undefined,
  github: undefined,
  linkedin: undefined,
};

export const projects: PortfolioProject[] = [
  {
    id: "edysonpos",
    slug: "edysonpos",
    title: "EdysonPOS",
    shortDescription: "Point of Sale for Indonesian supermarkets — cash & wholesale sales, thermal receipts, Telegram, PDF, barcode.",
    route: "/projects/edyson-pos",
    externalUrl: undefined,
  },
  {
    id: "three-sekawan",
    slug: "three-sekawan",
    title: "3Sekawan",
    shortDescription: "Billiard table & shop management — session billing (slot-based pricing), POS, expenses, multi-table tracking.",
    route: "/projects/three-sekawan",
    externalUrl: undefined,
  },
];
