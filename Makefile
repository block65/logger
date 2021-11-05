all:
	yarn build //...

clean:
	yarn build:clean

deps:
	yarn install --production=false --non-interactive

