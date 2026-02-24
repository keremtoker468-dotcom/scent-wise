---
name: web-ui-review
description: Review web UIs for design quality, accessibility, usability, responsiveness, and code quality. Use when asked to review, audit, or critique a web interface, webpage, component, or frontend codebase for visual quality, UX issues, WCAG compliance, responsive behavior, or cross-browser compatibility.
---

# Web UI Review

Perform comprehensive reviews of web user interfaces covering visual design, accessibility, usability, performance, and code quality.

## Review Process

1. **Understand context**: Identify the target audience, purpose, and platform requirements
2. **Visual inspection**: Assess design quality, consistency, and brand alignment
3. **Accessibility audit**: Check WCAG 2.1 AA compliance
4. **Responsive review**: Test layout across breakpoints
5. **Performance check**: Identify render-blocking issues, heavy assets, layout shifts
6. **Code quality**: Review HTML semantics, CSS architecture, JS patterns

## Visual Design Checklist

- Typography hierarchy is clear and consistent
- Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
- Spacing and alignment follow a consistent scale
- Interactive elements have visible hover/focus/active states
- Visual hierarchy guides the eye to primary actions
- Consistent use of borders, shadows, and elevation
- Icons are consistent in style and size

## Accessibility Checklist

- All images have meaningful `alt` text (or `alt=""` for decorative)
- Form inputs have associated `<label>` elements
- Focus order is logical and visible
- ARIA roles and attributes used correctly (not overused)
- Color is not the only means of conveying information
- Interactive elements are keyboard accessible
- Skip navigation link present
- Headings follow hierarchical order (h1 > h2 > h3)
- Sufficient touch target sizes (minimum 44x44px)

## Responsive Design Checklist

- Layout adapts gracefully at common breakpoints (320px, 768px, 1024px, 1440px)
- No horizontal scrolling on mobile
- Text remains readable without zooming
- Touch targets are appropriately sized on mobile
- Images scale properly and use responsive techniques
- Navigation adapts for mobile (hamburger, bottom nav, etc.)

## Performance Considerations

- Images are optimized and use modern formats (WebP, AVIF)
- Lazy loading for below-fold images and heavy components
- No layout shift (CLS) from dynamically loaded content
- Critical CSS is inlined or loaded first
- Font loading strategy prevents FOIT/FOUT
- Bundle size is reasonable for the complexity

## UX Best Practices

- Loading states provide feedback
- Error states are helpful and actionable
- Empty states guide users on next steps
- Forms provide inline validation and clear error messages
- Primary actions are visually prominent
- Destructive actions require confirmation
- Navigation is intuitive and consistent

## Code Quality

- Semantic HTML elements used appropriately
- CSS follows a consistent methodology (BEM, utility-first, CSS modules)
- No inline styles for reusable patterns
- JavaScript is unobtrusive and progressively enhanced
- Components are modular and reusable
- No unused CSS or JS
