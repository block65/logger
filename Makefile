SRCS = $(wildcard lib/**)

all: dist

.PHONY: deps
deps: node_modules

.PHONY: clean
clean:
	pnpm tsc -b --clean
	rm -rf dist

.PHONY: test
test:
	NODE_OPTIONS=--experimental-vm-modules pnpm jest

.PHONY: test-update
test-update:
	NODE_OPTIONS=--experimental-vm-modules pnpm jest -u

node_modules: package.json
	pnpm install

dist: node_modules tsconfig.json $(SRCS)
	pnpm tsc

.PHONY: dist-watch
dist-watch:
	pnpm tsc -w --preserveWatchOutput

.PHONY: pretty
pretty: node_modules
	pnpm eslint --fix .
	pnpm prettier --write .
