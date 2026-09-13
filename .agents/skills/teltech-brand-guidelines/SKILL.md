---
name: teltech-brand-guidelines
description: >-
  Enforces the official Teltech brand identity, premium dark mode aesthetics,
  exact HSL color tokens, glassmorphism, responsive spacing, and dynamic animations.
---

# Teltech Brand Guidelines

## Overview
This skill defines the official visual design system, color palette, typography, micro-animations, and UI components for the **Teltech** brand suite (including Teltech Ledger and associated mockup/sandbox applications). 

Any agent modifying, creating, or refactoring user interfaces in this workspace **MUST** read and adhere to these guidelines to ensure strict visual consistency, modern high-end dark mode styles, and a premium user experience.

---

## 🎨 Core Color Palette (HSL Tokens)

All colors are designed using HSL tokens for smooth alpha-blending and consistent tint/shade generation. Always prefer using Tailwind's semantic utility classes (e.g. `bg-primary`, `text-muted-foreground`) or standard custom HSL variables.

### 🌑 Dark Mode System (Default)

| Token Name | HSL Value | Hex Equivalent (Approx) | Usage / Description |
| :--- | :--- | :--- | :--- |
| `--background` | `240 3% 7%` | `#111113` | Deep, premium charcoal background. Never use pure black (`#000`). |
| `--foreground` | `0 0% 98%` | `#fafafa` | Soft off-white for maximum readability with reduced eye strain. |
| `--card` | `240 3% 18%` | `#2b2b2e` | Container background for cards and panels. |
| `--card-border` | `240 4% 20%` | `#313136` | Subtle separator for card borders. |
| `--popover` | `240 4% 12%` | `#1d1d20` | Tooltips, dropdowns, and context menu overlays. |
| `--border` | `240 4% 20%` | `#313136` | Default subtle divider lines and borders. |
| `--input` | `240 4% 15%` | `#232326` | Background for input fields, textareas, and selects. |
| `--muted` | `240 4% 22%` | `#36363c` | Secondary disabled / non-interactive background. |
| `--muted-foreground`| `240 5% 65%` | `#a1a1aa` | Muted labels, secondary descriptions, and placeholders. |

### ✨ Brand Accents & Roles

| Character / Role | Role Title | Brand Color (HSL) | Branding Concept |
| :--- | :--- | :--- | :--- |
| **Tarcísio** | `CEO / Primário` | `hsl(265 85% 62%)` | **Vibrant Amethyst / Purple**. Represents the "Wise Worded Technical Thief". |
| **Lucas** | `CTO / Sucesso` | `hsl(152 65% 45%)` | **Emerald Green**. Represents the "Arcane Developer / Infrastructure Wizard". |
| **Spiri** | `CMO / Secundário`| `hsl(220 70% 55%)` | **Electric Cobalt Blue**. Represents the "Alchemist / Lead Transmuter". |
| **Danger** | `Destructive` | `hsl(0 70% 58%)` | **Vibrant Crimson Red**. Used for critical/destructive actions. |

---

## 💎 Advanced Visual Effects

To achieve a premium "wowed at first glance" feel, use these standard Tailwind utilities and custom gradients:

### 1. Mesh Gradients
Use `bg-mesh` to create a beautiful, glowing organic background mesh:
```css
--gradient-mesh:
  radial-gradient(at 20% 20%, hsl(265 85% 62% / 0.28) 0px, transparent 55%),
  radial-gradient(at 80% 0%, hsl(270 90% 72% / 0.18) 0px, transparent 55%),
  radial-gradient(at 80% 80%, hsl(152 65% 45% / 0.12) 0px, transparent 55%),
  radial-gradient(at 0% 80%, hsl(240 3% 4% / 0.6) 0px, transparent 55%);
```

### 2. Glassmorphism (`glass` utility)
Apply premium frosted glass to headers, sidebars, and high-priority cards:
```html
<div class="glass rounded-xl p-6">
  <!-- Content -->
</div>
```
*CSS Definition:*
```css
.glass {
  background: linear-gradient(135deg, hsl(var(--card) / 0.75), hsl(var(--card) / 0.55));
  backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid hsl(var(--border) / 0.8);
}
```

### 3. Glow and Shadows
Never use standard generic drop shadows. Instead, apply these specialized shadows for cards and brand elements:
- **Card Shadow:** `shadow-card` (`0 10px 40px -10px hsl(0 0% 0% / 0.55)`)
- **Glowing Accent (Purple):** `shadow-glow` (`0 0 50px hsl(265 85% 62% / 0.35)`)
- **Elegant Floating Border:** `shadow-elegant` (`0 20px 60px -20px hsl(265 85% 62% / 0.45)`)

---

## 🎬 Dynamic Micro-Animations

Interactive elements must feel alive. Use the following animation classes to delight users:

1.  **`animate-float-orb`**: Slowly floats background decoration items and glowing orbs.
2.  **`animate-shake`**: Gently shakes elements to indicate validation errors or failed inputs.
3.  **`animate-wave`**: A friendly hand-waving animation, triggered on welcome states or greetings.
4.  **`animate-fade-up`**: Smooth entry animation for newly loaded lists or page transitions.
5.  **`animate-pulse-ring`**: Creates a radiating circle of light behind buttons or notifications to call attention.

---

## 🛠️ Premium Component Blueprints

When building new components, always use this premium reference code as a baseline:

### 1. The Glassmorphic Brand Button
```tsx
import React from 'react';
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
}

export const BrandButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', children, ...props }, ref) => {
    const baseStyles = "relative overflow-hidden inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background";
    
    const variants = {
      primary: "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow hover:brightness-110 focus:ring-primary",
      secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-muted focus:ring-secondary",
      success: "bg-success text-success-foreground hover:brightness-110 focus:ring-success",
      danger: "bg-destructive text-destructive-foreground hover:brightness-110 focus:ring-destructive",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        <span className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
        {children}
      </button>
    );
  }
);
```

### 2. High-Fidelity Data Card
```tsx
export const PremiumCard = ({ title, subtitle, value, trend, icon: Icon }) => {
  return (
    <div className="glass hover:border-primary/50 transition-all duration-300 shadow-card hover:shadow-elegant rounded-xl p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground/60">{subtitle}</p>}
        </div>
        <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {trend && (
          <span className={`text-xs font-semibold ${trend.positive ? 'text-success' : 'text-destructive'}`}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
};
```

---

## 🚫 Common Pitfalls to Avoid

*   **DON'T** use default bootstrap-like colors (e.g. `bg-blue-500`, `bg-green-500`, `bg-red-500`). Always reference the custom theme variables: `bg-primary`, `bg-success`, and `bg-destructive`.
*   **DON'T** use generic solid borders (`border-gray-800`). Use `border-border` or opacity layers (`border-border/50`).
*   **DON'T** design "flat" card systems without depth. Always use subtle gradients, glassmorphism filters, and organic shadow effects to convey altitude.
*   **DON'T** use pure sharp corners (`rounded-none`). Standard rounding for buttons is `rounded-lg` (`8px`) and for cards is `rounded-xl` (`12px` / `0.75rem`).
