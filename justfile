check: typecheck lint fmt-check test dead-code dupes pack

typecheck:
	pnpm exec oxlint --type-aware --type-check

lint:
	pnpm exec oxlint

# annotates the changed lines in a pull request
lint-ci:
	pnpm exec oxlint --format=github

fmt:
	pnpm exec oxfmt

fmt-check:
	pnpm exec oxfmt --check

test:
	pnpm exec vitest run

dead-code:
	pnpm exec fallow dead-code

dupes:
	pnpm exec fallow dupes

# lists what npm would receive, without publishing
pack:
	pnpm pack --dry-run

clean:
	rm -rf node_modules

# no build, so just alias and keep the standard
dist-clean: clean
