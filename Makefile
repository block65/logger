TESTCMD := docker run \
			--rm -ti \
			-u $(shell id -u) \
			-v $(CURDIR):/srv/test \
			-w /srv/test \
			node:14 \
			yarn test

all: dist

dist: node_modules
	yarn tsc

clean:
	rm -rf dist/*

distclean: clean
	rm -rf node_modules

node_modules:
	yarn install --production=false --non-interactive --frozen-lockfile

test: node_modules
	$(TESTCMD)

dev: node_modules
	$(TESTCMD) --watchAll
