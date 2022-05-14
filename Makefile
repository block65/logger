all: test
	yarn build //...

clean:
	yarn build:clean

test:
	yarn test

test-update:
	yarn test:update

deps:
	yarn install --production=false --non-interactive

