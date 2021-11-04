DOCKER_FLAGS ?= -ti

USER_ID = $(shell id -u)

CMD=yarn test

ifdef DEBUG
	DOCKER_FLAGS=-p 9229:9229
	CMD=node --inspect-brk=0.0.0.0:9229 node_modules/.bin/jest
endif

TESTCMD = docker run \
			--rm \
			--init \
			-u $(USER_ID) \
			-v $(CURDIR):/srv/test \
			-w /srv/test \
			-e NODE_ENV=development \
			$(DOCKER_FLAGS) \
			node:16 \
			$(CMD)

all: dist

dist: node_modules
	yarn tsc

clean:
	rm -rf dist/*

distclean: clean
	rm -rf node_modules

node_modules:
	yarn install --production=false --non-interactive --frozen-lockfile

test: dist
	$(TESTCMD) $(ifdef DEBUG, --runInBand)

test-update: dist
	$(TESTCMD)

dev: node_modules
	$(TESTCMD) --watchAll
