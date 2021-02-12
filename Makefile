TESTCMD := \
	docker run \
		--rm -ti \
		-u $(shell id -u) \
		-v $(CURDIR):/srv/test \
		-w /srv/test \
		node \
		yarn test

test:
	$(TESTCMD)

test-watch:
	$(TESTCMD) --watchAll

test-update:
	$(TESTCMD) -u
