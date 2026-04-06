# Contributing to htex

Thank you for your interest in contributing to **htex**! This document provides guidelines and instructions for contributing.

## 🎯 Ways to Contribute

- 🐛 **Report Bugs** — Found an issue? Open a GitHub Issue
- 💡 **Suggest Features** — Have a great idea? We'd love to hear it
- 📝 **Improve Documentation** — Help us improve guides and examples
- 🔧 **Submit Code** — Fix bugs or implement features
- 🧪 **Write Tests** — Improve test coverage
- 💬 **Answer Questions** — Help other developers in Discussions

## 🚀 Getting Started

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/htex.git
cd htex
```

### 2. Install Dependencies

```bash
bun install  # or npm install
```

### 3. Build the Project

```bash
bun run build
```

### 4. Run Tests

```bash
bun test
```

### 5. Run Demo

```bash
bun run demo:react
```

## 📋 Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/my-amazing-feature
```

Use descriptive branch names:
- `feature/` for new features
- `fix/` for bug fixes
- `docs/` for documentation
- `test/` for test improvements
- `refactor/` for code refactoring

### Making Changes

1. Write clear, focused commits
2. Follow the existing code style
3. Add tests for new functionality
4. Update documentation if needed

### Commit Messages

Use clear, conventional commit messages:

```
feat: add support for \footnote command
fix: resolve text shifting at 200% zoom
docs: improve pagination algorithm explanation
test: add edge case tests for margin collapse
refactor: simplify tokenizer regex patterns
```

### Testing

Before submitting, ensure all tests pass:

```bash
bun test
```

Aim for good test coverage, especially for:
- New tokenizer commands
- Parser edge cases
- Renderer output quality
- Pagination boundary conditions

## 🎨 Code Style

### TypeScript

- Use strict mode (`strict: true` in tsconfig)
- Prefer explicit types over `any`
- Use descriptive variable names
- Add JSDoc comments for public APIs

Example:

```typescript
/**
 * Paginate a document in place.
 * 
 * @param container - Element to search for .htex-document elements
 * @param options - Pagination options
 * @returns void
 */
export function htexPaginate(
  container?: Element | Document,
  options?: PaginationOptions
): void {
  // Implementation
}
```

### CSS

- Use CSS variables for colors
- Follow BEM-like naming for classes
- Ensure responsive design
- Test in both light and dark modes

## 📚 Documentation

### README Updates

- Keep examples up-to-date
- Add screenshots for visual changes
- Document new APIs clearly
- Update feature lists

### Code Comments

For complex logic:

```typescript
// Contextual measurement: measure accumulated height with CSS margin-collapse
// This is more accurate than summing individual element heights
const totalHeight = pageBox.getBoundingClientRect().height
```

## 🔍 Pull Request Process

### Before Submitting

1. ✅ Tests pass locally (`bun test`)
2. ✅ Build succeeds (`bun run build`)
3. ✅ Code follows style guidelines
4. ✅ Documentation is updated
5. ✅ Commit messages are clear

### PR Description

Include:

- **What** — What does this change do?
- **Why** — Why is this change necessary?
- **How** — How does it work?
- **Testing** — How was it tested?
- **Screenshots** — For visual changes, include before/after

Template:

```markdown
## Description
Brief explanation of the change.

## Motivation & Context
Why is this change needed? What problem does it solve?

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
How was this tested?
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] All tests pass

## Screenshots (if applicable)
Include before/after screenshots for visual changes.

## Related Issues
Closes #123
```

### Review Process

- Be responsive to feedback
- Expect 1-2 rounds of review
- Discuss concerns respectfully
- Update PR based on feedback

## 🐛 Bug Reports

### Good Bug Report Includes

1. **Clear Title** — Summarize the issue
2. **Steps to Reproduce** — Exact steps to recreate
3. **Expected Behavior** — What should happen
4. **Actual Behavior** — What actually happens
5. **Environment** — OS, Node version, browser
6. **Screenshots** — If applicable

Example:

```markdown
## Bug: Text shifts at 150% zoom

### Steps to Reproduce
1. Open htex in browser
2. Zoom to 150% (Ctrl++)
3. Scroll through pages
4. Observe text movement

### Expected
Text should remain stable, no jumping.

### Actual
Text shifts left/right while scrolling.

### Environment
- Browser: Chrome 125
- OS: macOS 14
- htex version: 1.0.0
```

## 💡 Feature Requests

### Good Feature Request Includes

1. **Clear Description** — What feature?
2. **Use Case** — Why is this needed?
3. **Examples** — Show desired behavior
4. **Possible Implementation** — Optional suggestions

Example:

```markdown
## Feature: Support \label and \ref commands

### Description
Allow documents to use LaTeX cross-references.

### Use Case
Long technical documents need internal references like "See Figure 3.2"

### Example
\begin{equation}\label{eq:einstein}
E = mc^2
\end{equation}

Equation \ref{eq:einstein} is famous.

### Implementation Notes
Could use ID attributes and anchor links.
```

## 🚀 Areas We Need Help

- 📱 **Mobile responsiveness** — Improve mobile experience
- ♿ **Accessibility** — WCAG 2.1 compliance
- 🧪 **Test coverage** — Increase coverage above 80%
- 📖 **Documentation** — Add more examples
- 🌍 **i18n** — Internationalization support
- ⚡ **Performance** — Optimize rendering speed
- 🎨 **UI/UX** — Demo app improvements

## 📞 Questions?

- 📝 Check the [wiki](https://github.com/yourusername/htex/wiki)
- 💬 Ask in [Discussions](https://github.com/yourusername/htex/discussions)
- 📧 Email: hello@htex.dev

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to htex! 🎉**
