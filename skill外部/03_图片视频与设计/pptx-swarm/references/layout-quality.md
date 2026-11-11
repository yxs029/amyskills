# Layout Quality Checklist

This is an advisory checklist for the PPTD swarm workflow. It does not replace the bundled `guideline/design/*` workflow, scenario profiles, or page-agent guidelines.

Do not use fixed output templates. You may reference selected design profiles or other deck-design references when they fit the deck, then translate those principles into native PPTD theme/layout decisions.

The linter is heuristic. Use it to find pages worth inspecting; do not treat its numeric score as a design truth or hard delivery blocker.

## Page Budget

- Slide size: 1280 x 720.
- Safe area: x 60-1220, y 45-675.
- Keep title/action-title separate from body content.
- Keep source/footer text below y 635 when possible.
- Prefer font sizes: title 28-36, section labels 16-22, body 16-22, table 12-16, source/footer 9-11.
- Keep body text readable before optimizing fit. If content only fits below 14px body text or below 11px table text, split, shorten, or restructure the slide.
- Keep meaningful content out of the outer edge band. Do not let text, table cells, legends, or chart labels touch the canvas edge.

## Density

Typical information area for normal content pages: roughly 20%-75% of the safe area.

- Too empty: large decorative cards, chart areas, or frames with little text/data. Add useful content, reduce container size, or remove the container.
- Too crowded: many paragraphs, dense tables, or competing charts. Split the page, shorten copy, or remove secondary material.
- Avoid one-sided pages: if one half has almost all content and the other half is mostly blank, rebalance or change the composition.
- Avoid deck-level whiplash: do not alternate very empty divider/card pages with very crowded content pages. This reads worse than a consistent medium-density deck.
- Exceptions are valid only when intentional and information-bearing: cover pages, chapter dividers, hero-image pages, screenshot pages, legal/academic dense evidence pages, and deliberately asymmetric editorial pages still need a clear message, visual anchor, or section preview.
- Low-signal structure pages are capped at 2 pages or 12% of the deck. If a cover, chapter, discussion, or closing page has only a label and empty space, merge it into an adjacent content page or add useful context.

## Layout Skeleton Contract

Before writing `.page` files, every planned page should have a short layout contract in `page_manifest.json`:

- `layout_skeleton`: intended geometry, not a template name.
- `content_budget`: visible content count, such as bullets, chart, table, source line, or discussion questions.
- `density_intent`: low/normal/dense and why the density is appropriate.
- `qa_risks`: likely visual failure modes to avoid.

Use this contract to prevent common failures:

- Empty container: a large card/frame/chart lane with one short sentence.
- Crowded container: a card/table/text box that needs tiny fonts or overlaps.
- Placeholder chart: chart area exists but labels show placeholders or too few data points.
- Asymmetric void: one side of the slide is blank without an intentional focal image or argument.
- Section bloat: repeated chapter pages that add no information.

## Advisory Static Lint

When useful, run:

```bash
python3 scripts/pptd_layout_lint.py <deck>.pptd
```

Review its findings before conversion, but do not optimize mechanically for the score. If a finding conflicts with the selected design profile or the deck's intentional layout, keep the design and rely on rendered preview and post-render judge.

Common repairs:

- Text overflow: shorten text, increase box height, reduce font within readable bounds, or split the page.
- Element overlap: move elements, reduce chart/table area, or remove decorative containers.
- Small font: reduce content rather than shrinking below readable sizes.
- Low density: shrink empty frames, add useful annotations, or replace oversized placeholders.
- High density: split the page or move details into appendix/source notes.
- Low-signal chart: use a smaller chart, add data labels/annotation, or replace with a compact table.
- Chapter/divider overuse: merge into the next content slide, or add a mini-preview with 2-3 section claims.
- Discussion page emptiness: include concise context under each question, or reduce the number/size of question cards.

## Free-Form Composition Guidance

Use composition intent only as a planning label, not as a template or a hard linter target:

- chart-and-insight: one main chart and one concise insight block.
- comparison: two or more entities compared on a small number of dimensions.
- timeline: phases or milestones with deliverables and decision points.
- matrix: rows/columns where every cell carries useful information.
- framework: concept map or architecture view with clear relationships.
- discussion: prompts or questions with enough context for action.
- freeform: any other layout that follows the design plan and survives visual review.

If a page repeatedly triggers advisory findings, inspect the rendered slide. Repair only if the issue is visually real.
