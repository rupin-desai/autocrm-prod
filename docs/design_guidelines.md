# Design Guidelines: Car Parts & Service Shop Management System

## Design Approach: Modern Dashboard System

**Selected Approach:** Professional dashboard design system inspired by Linear (clean data display), Stripe Dashboard (information hierarchy), and Notion (organized tables).

**Rationale:** This is a utility-focused, information-dense application where efficiency and data clarity are paramount. The design prioritizes rapid information access, clear status indicators, and streamlined workflows for daily shop operations.

**Core Design Principles:**
- Information clarity over visual flair
- Consistent data presentation patterns
- Clear visual hierarchy for status and actions
- Efficient space usage for dense information
- Professional, trust-building aesthetics

## Color Palette

### Dark Mode (Primary)
- **Background Base:** 220 15% 10% (deep slate)
- **Surface:** 220 15% 14% (elevated panels)
- **Surface Elevated:** 220 15% 18% (cards, modals)
- **Border:** 220 10% 25% (subtle divisions)
- **Text Primary:** 220 10% 95% (main content)
- **Text Secondary:** 220 8% 70% (labels, metadata)
- **Text Muted:** 220 5% 50% (placeholders)

### Light Mode
- **Background Base:** 220 15% 98%
- **Surface:** 0 0% 100%
- **Surface Elevated:** 220 10% 97%
- **Border:** 220 10% 88%
- **Text Primary:** 220 15% 15%
- **Text Secondary:** 220 10% 40%
- **Text Muted:** 220 5% 55%

### Brand & Accent Colors
- **Primary Brand:** 210 95% 50% (professional blue - CTAs, links, active states)
- **Success:** 145 65% 45% (completed services, in stock, positive metrics)
- **Warning:** 35 90% 55% (low stock alerts, pending items)
- **Danger:** 0 75% 55% (out of stock, overdue, critical alerts)
- **Info:** 200 85% 50% (informational badges, secondary actions)

### Status Color System
- **Inquired:** 200 70% 50% (light blue)
- **Working:** 35 90% 55% (amber - active work)
- **Waiting for Parts:** 280 60% 55% (purple - blocked state)
- **Completed:** 145 65% 45% (green - success)

## Typography

**Font Stack:** 
- Primary: Inter (via Google Fonts CDN) - excellent for data display and UI
- Monospace: JetBrains Mono (for SKUs, serial numbers, codes)

**Type Scale:**
- **Display (Dashboard Headers):** text-3xl font-bold (30px)
- **Page Titles:** text-2xl font-semibold (24px)
- **Section Headers:** text-xl font-semibold (20px)
- **Card Titles:** text-lg font-medium (18px)
- **Body Text:** text-base font-normal (16px)
- **Secondary Text:** text-sm font-normal (14px)
- **Captions/Labels:** text-xs font-medium (12px)
- **Table Headers:** text-sm font-semibold uppercase tracking-wide
- **Data Values:** text-base font-medium (for numbers, prices, quantities)

## Layout System

**Spacing Primitives:** Consistent use of Tailwind units: 2, 4, 6, 8, 12, 16, 20, 24

**Grid Structure:**
- Dashboard: 12-column responsive grid
- Sidebar: Fixed 64 (collapsed) / 256px (expanded)
- Main content: max-w-7xl with px-6 py-8
- Cards: p-6 standard, p-4 for compact variants
- Table cells: px-4 py-3 (comfortable data density)

**Responsive Breakpoints:**
- Mobile: base (stack all columns)
- Tablet: md: (2-column layouts where appropriate)
- Desktop: lg: (full dashboard layouts, 3+ columns)

## Component Library

### Navigation
- **Sidebar:** Fixed left navigation with icon + label, collapsible
  - Active state: bg-surface-elevated with left border accent (border-l-4 border-primary)
  - Hover: bg-surface-elevated/50
  - Section dividers with text-xs uppercase labels
  - Role-based menu items with subtle badges for restricted access

### Data Display
- **Tables:** 
  - Zebra striping (even rows: bg-surface)
  - Hover: bg-surface-elevated
  - Sticky headers with shadow on scroll
  - Action column (right-aligned) with icon buttons
  - Status badges in their own column
  - Pagination at bottom-right
  
- **Cards:**
  - Standard: bg-surface rounded-lg border border-border shadow-sm
  - Interactive: hover:shadow-md transition-shadow
  - Header with title + action button
  - Content with p-6, footer with border-t

- **Status Badges:**
  - Pill shape: px-3 py-1 rounded-full text-xs font-medium
  - Color-coded backgrounds with 10% opacity + solid text
  - Icons for critical statuses (AlertCircle, CheckCircle)

### Forms
- **Input Fields:**
  - bg-surface border border-border rounded-md px-4 py-2.5
  - Focus: ring-2 ring-primary ring-offset-2 ring-offset-background
  - Labels: text-sm font-medium mb-2
  - Helper text: text-xs text-secondary mt-1
  - Error state: border-danger with text-danger message

- **Buttons:**
  - Primary: bg-primary text-white hover:bg-primary/90 px-4 py-2.5 rounded-md font-medium
  - Secondary: bg-surface border border-border hover:bg-surface-elevated
  - Danger: bg-danger text-white
  - Ghost: hover:bg-surface-elevated (for table actions)
  - Icon buttons: p-2 rounded-md (32x32 touch target)

### Dashboard Specific
- **KPI Cards:**
  - Large number: text-3xl font-bold
  - Label: text-sm text-secondary
  - Trend indicator: small arrow + percentage in success/danger color
  - Icon in top-right (ghost style, large)

- **Service Workflow Stages:**
  - Horizontal stepper/pipeline view
  - Active stage: bold with primary color highlight
  - Completed: checkmark with success color
  - Future stages: muted with dashed connectors
  - Card-based current items under each stage (Kanban style)

- **Digital Customer Card:**
  - Two-column layout: Customer info (left) + Service history (right)
  - Timeline view for service history with timestamps
  - "Serviced by" with avatar + name
  - QR code placeholder (centered, bg-white p-4 rounded)

### Alerts & Notifications
- **Notification Center:**
  - Dropdown panel from header bell icon
  - List of notifications with icon, message, timestamp
  - Unread: bg-primary/5 with dot indicator
  - "Mark all read" action at bottom

- **Alert Banners:**
  - Info: bg-info/10 border-l-4 border-info px-4 py-3
  - Warning: bg-warning/10 border-l-4 border-warning
  - Success: bg-success/10 border-l-4 border-success
  - Dismissible with X button

### Data Visualization
- **Simple Charts:** Use Chart.js or Recharts
  - Bar charts: primary color fills
  - Line charts: stroke with gradient fill (10% opacity)
  - Pie/Donut: status color palette
  - Grid lines: border-border color, subtle

## Images

This dashboard application requires minimal imagery:

- **No hero images** - this is a utility application
- **Employee avatars:** 40px circular thumbnails (use placeholder initials with bg-primary/20)
- **Product images:** 64x64 thumbnails in product lists, 400x400 in product details
- **Customer vehicle images (optional):** 200x150 aspect ratio in customer cards
- **Empty state illustrations:** Simple line-art SVG illustrations for empty tables/lists (use subtle colors)
- **Logo:** Top-left of sidebar, 40px height, with optional wordmark

## Animations

**Minimal and purposeful only:**
- Page transitions: None (instant navigation for speed)
- Dropdown menus: duration-150 ease-out
- Modal overlays: fade-in duration-200
- Loading states: Subtle spinner or skeleton screens
- Toast notifications: slide-in-right duration-300

**No decorative animations** - focus on instant responsiveness

## Special Considerations

**Role-Based Visual Cues:**
- Restricted features: opacity-50 with lock icon
- Admin-only sections: subtle red badge indicator
- Current user role: displayed in sidebar header with badge

**Print Optimization:**
- Invoices and Digital Cards: @media print styles
- Remove sidebar/navigation in print view
- Black text on white background
- Page break controls for multi-page documents

**Data Density Controls:**
- Compact view toggle for tables (reduces padding)
- Expandable rows for detailed information
- Collapsible sidebar for more content space