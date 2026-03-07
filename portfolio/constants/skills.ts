/**
 * Skills showcase data. Edit categories and items to match what you know and can do.
 * icon: Ionicons name (e.g. "logo-react", "code-slash-outline"); leave empty for no icon.
 */

export interface SkillItem {
  name: string;
  icon?: string;
}

export interface SkillCategory {
  id: string;
  title: string;
  items: SkillItem[];
}

export const skillCategories: SkillCategory[] = [
  {
    id: "languages",
    title: "Languages & runtimes",
    items: [
      { name: "TypeScript", icon: "code-slash-outline" },
      { name: "JavaScript", icon: "logo-javascript" },
      { name: "Node.js", icon: "logo-nodejs" },
      { name: "SQL", icon: "server-outline" },
    ],
  },
  {
    id: "frontend",
    title: "Frontend",
    items: [
      { name: "React", icon: "logo-react" },
      { name: "React Native", icon: "phone-portrait-outline" },
      { name: "Expo", icon: "phone-portrait-outline" },
      { name: "Expo Router", icon: "navigate-outline" },
      { name: "HTML / CSS", icon: "document-text-outline" },
    ],
  },
  {
    id: "mobile",
    title: "Mobile & cross-platform",
    items: [
      { name: "iOS & Android", icon: "phone-portrait-outline" },
      { name: "Responsive web", icon: "desktop-outline" },
      { name: "Native APIs (Camera, Bluetooth)", icon: "hardware-chip-outline" },
    ],
  },
  {
    id: "backend",
    title: "Backend & data",
    items: [
      { name: "Supabase", icon: "cloud-outline" },
      { name: "REST APIs", icon: "git-network-outline" },
      { name: "Auth & RLS", icon: "shield-checkmark-outline" },
    ],
  },
  {
    id: "tools",
    title: "Tools & practices",
    items: [
      { name: "Git", icon: "git-branch-outline" },
      { name: "EAS Build", icon: "construct-outline" },
      { name: "Vercel", icon: "rocket-outline" },
      { name: "Figma", icon: "color-palette-outline" },
      { name: "Agile / iteration", icon: "calendar-outline" },
    ],
  },
];
