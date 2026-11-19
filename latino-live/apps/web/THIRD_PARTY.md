# Component sources

components/ui uses the MIT-licensed shadcn/ui Radix Maia registry at https://ui.shadcn.com/r/styles/radix-maia/registry.json. Original component APIs and classes are preserved; local imports resolve through @/components/ui and @/lib/utils.

Local fixes retain accessible progress values, single-value slider defaults and deterministic skeleton hydration. Registry icon placeholders resolve to Lucide. See LICENSE.shadcn.

app/shadcn-tailwind.css is shadcn 4.21.5 `dist/tailwind.css` (MIT): the data-state variants (data-open, data-checked, data-active and others), keyframes and utilities the Radix Maia components rely on.
