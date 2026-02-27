# Spec-Driven Development

Every non-trivial feature begins as a spec document in this directory.

## Workflow

1. **Create a spec** -- `make spec NAME=my-feature` copies the template.
2. **Fill it out** -- Define What, Why, User Flow, Acceptance Criteria, Technical Notes, and Out of Scope.
3. **Review** -- Open a PR with the spec for team feedback before writing code.
4. **Build** -- Implement against the accepted spec. Reference it in your PR description.
5. **Complete** -- When the feature ships, move the spec to `specs/completed/`.

## Directory Layout

```
specs/
  _template.md       # Starting point for new specs
  README.md           # This file
  completed/          # Shipped specs (archive)
  my-feature.md       # Active spec (example)
```

## Guidelines

- Keep specs short (1--2 pages). If it is longer, the feature is too big -- split it.
- Acceptance criteria must be testable. "Works well" is not a criterion.
- Out of Scope is just as important as the feature description.
- Specs are living documents. Update them as decisions change, but note the revision.
