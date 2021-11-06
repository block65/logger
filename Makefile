all: test
	yarn build //...

clean:
	yarn build:clean

test:
	yarn test

deps:
	yarn install --production=false --non-interactive

